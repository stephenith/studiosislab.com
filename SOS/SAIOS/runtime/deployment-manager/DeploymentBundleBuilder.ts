/**
 * Build deployment bundle metadata from plan + scripts + validation.
 */
import type {
  DeploymentBundle,
  DeploymentPlan,
  ValidationCheck,
} from "./types.js";

export function buildDeploymentBundle(input: {
  plan: DeploymentPlan;
  generatedAt: string;
  version: string;
  bundlePrefix: string;
  validations: ValidationCheck[];
  scriptNames: { startup: string; shutdown: string; restart: string };
}): DeploymentBundle {
  const validation_pass = input.validations.every((v) => v.pass);
  const available = input.plan.available_count;
  const total = input.plan.department_count;

  let status: DeploymentBundle["status"] = "READY";
  if (!validation_pass || available < total) status = "DEGRADED";
  if (available < Math.ceil(total * 0.7)) status = "BLOCKED";

  const stamp = input.generatedAt.replace(/[:.]/g, "-");
  return {
    generated_at: input.generatedAt,
    version: input.version,
    bundle_id: `${input.bundlePrefix}-${stamp}`,
    status,
    artifacts: [
      "deployment-plan.json",
      "deployment-bundle.json",
      "startup-order.json",
      "startup.sh",
      "shutdown.sh",
      "restart.sh",
      "environment-check.json",
      "deployment-report.md",
    ],
    startup_order: input.plan.startup_order,
    departments: input.plan.departments.map((d) => ({
      id: d.id,
      label: d.label,
      module_path: d.module_path,
      available: d.available,
      verify_command: d.verify_command,
    })),
    scripts: input.scriptNames,
    validation_pass,
  };
}
