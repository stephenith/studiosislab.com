import type { FounderObjective, DeliveryPlan } from "./types.js";
import { FeaturePlanner } from "./FeaturePlanner.js";
import { EpicDecomposer } from "./EpicDecomposer.js";
import { TaskBatchBuilder } from "./TaskBatchBuilder.js";
import { DependencyResolver } from "./DependencyResolver.js";
import { buildDeliveryReport, writeDeliveryReport, type DeliveryReport } from "./DeliveryReport.js";

export const FORBIDDEN_PRODUCT_ACTIONS = [
  "run_cursor",
  "write_product_code",
  "modify_queue",
  "modify_registry",
  "modify_runtime_loop",
  "execute_jobs",
] as const;

export type ProductDeliveryEngineOptions = {
  reportsDir?: string;
  batch_size?: number;
};

/**
 * Product Delivery Engine — planning only.
 * Never runs Cursor, writes product code, or touches Queue/Registry/Runtime Loop.
 */
export class ProductDeliveryEngine {
  private readonly featurePlanner: FeaturePlanner;
  private readonly epicDecomposer: EpicDecomposer;
  private readonly batchBuilder: TaskBatchBuilder;
  private readonly dependencyResolver: DependencyResolver;
  private readonly reportsDir?: string;

  constructor(options: ProductDeliveryEngineOptions = {}) {
    this.featurePlanner = new FeaturePlanner();
    this.epicDecomposer = new EpicDecomposer();
    this.batchBuilder = new TaskBatchBuilder({ batch_size: options.batch_size });
    this.dependencyResolver = new DependencyResolver();
    this.reportsDir = options.reportsDir;
  }

  static assertPlanningOnly(action: string): void {
    if ((FORBIDDEN_PRODUCT_ACTIONS as readonly string[]).includes(action)) {
      throw new Error(
        `ProductDeliveryEngine: action "${action}" is forbidden — planning only`,
      );
    }
  }

  plan(objective: FounderObjective): DeliveryPlan {
    const epic = this.featurePlanner.planEpic(objective);
    const features = this.featurePlanner.planFeatures(epic);
    const jobs = this.epicDecomposer.decompose(epic, features);
    const batches = this.batchBuilder.buildBatches(features, jobs);
    const dependencies = this.dependencyResolver.resolve(features, jobs);
    const execution_order = this.dependencyResolver.topologicalOrder(jobs, dependencies);

    return {
      epic,
      features,
      jobs,
      batches,
      dependencies,
      execution_order,
    };
  }

  async deliver(objective: FounderObjective): Promise<DeliveryReport> {
    const plan = this.plan(objective);
    const criticalPath = this.dependencyResolver.criticalPath(plan.jobs, plan.dependencies);
    const report = buildDeliveryReport(plan, criticalPath);
    await writeDeliveryReport(report, this.reportsDir);
    return report;
  }
}
