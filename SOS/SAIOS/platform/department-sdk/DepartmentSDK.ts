/**
 * DepartmentSDK — sole supported department contract surface (Agent #180).
 * No execution. No activation. Contracts & discovery only.
 */
import { resolve } from "node:path";
import { DepartmentRegistry } from "./DepartmentRegistry.js";
import { DepartmentReporter } from "./DepartmentReporter.js";
import { validateDepartment } from "./DepartmentValidator.js";
import { buildResumeDepartmentReference } from "./catalog/resumeReference.js";
import { buildPlaceholderDepartments } from "./catalog/placeholders.js";
import type {
  DepartmentCapabilityContract,
  DepartmentContract,
  DepartmentDirectorContract,
  DepartmentManagerContract,
  DepartmentSummary,
  DepartmentValidationResult,
  DepartmentWorkerContract,
} from "./DepartmentTypes.js";
import { Department } from "./Department.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class DepartmentSDK {
  readonly registry: DepartmentRegistry;
  readonly reporter: DepartmentReporter;
  readonly root: string;
  private bootstrapped = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new DepartmentRegistry(this.root, opts);
    this.reporter = new DepartmentReporter();
  }

  /**
   * Seed Resume reference + placeholders once.
   * Idempotent. Never activates runtime departments.
   */
  bootstrapCanonicalCatalog(): {
    ok: boolean;
    registered: string[];
    errors: string[];
  } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, registered: [], errors: ["LIVE must be OFF"] };
    }
    this.registry.loadPersisted();
    const registered: string[] = [];
    const errors: string[] = [];

    const resume = buildResumeDepartmentReference();
    if (!this.registry.find(resume.department_id)) {
      const r = this.registry.register(resume);
      if (r.ok) {
        this.registry.validate(resume.department_id);
        // Resume reference starts READY in contract; ensure READY after validate
        const cur = this.registry.find(resume.department_id);
        if (cur && cur.status === "VALIDATED") {
          this.registry.markReady(resume.department_id);
        } else if (cur && cur.status === "READY") {
          // already ready from contract — re-persist
          this.registry.persist();
        }
        registered.push(resume.department_id);
      } else if (r.error) errors.push(r.error);
    }

    for (const p of buildPlaceholderDepartments()) {
      if (this.registry.find(p.department_id)) continue;
      const r = this.registry.register(p);
      if (r.ok) registered.push(p.department_id);
      else if (r.error) errors.push(r.error);
    }

    this.reporter.writeMarkdown(this.registry);
    this.bootstrapped = true;
    return { ok: errors.length === 0, registered, errors };
  }

  ensureBootstrapped(): void {
    if (this.bootstrapped || this.registry.list().length > 0) {
      if (this.registry.list().length === 0) this.registry.loadPersisted();
      if (this.registry.list().length === 0) this.bootstrapCanonicalCatalog();
      this.bootstrapped = true;
      return;
    }
    this.bootstrapCanonicalCatalog();
  }

  registerDepartment(dept: DepartmentContract): {
    ok: boolean;
    error?: string;
  } {
    return this.registry.register(dept);
  }

  validateDepartment(departmentId: string) {
    return this.registry.validate(departmentId);
  }

  validateDepartmentContract(
    dept: DepartmentContract,
  ): DepartmentValidationResult {
    return validateDepartment(dept);
  }

  loadDepartment(departmentId: string): Department | null {
    this.ensureBootstrapped();
    return this.registry.load(departmentId);
  }

  listDepartments(): DepartmentSummary[] {
    this.ensureBootstrapped();
    return this.registry.discover();
  }

  discoverWorkers(departmentId?: string): DepartmentWorkerContract[] {
    this.ensureBootstrapped();
    const depts = departmentId
      ? [this.registry.find(departmentId)].filter(Boolean)
      : this.registry.list();
    return depts.flatMap((d) => d!.workers);
  }

  discoverCapabilities(departmentId?: string): DepartmentCapabilityContract[] {
    this.ensureBootstrapped();
    const depts = departmentId
      ? [this.registry.find(departmentId)].filter(Boolean)
      : this.registry.list();
    return depts.flatMap((d) => d!.capabilities);
  }

  discoverManagers(departmentId?: string): DepartmentManagerContract[] {
    this.ensureBootstrapped();
    const depts = departmentId
      ? [this.registry.find(departmentId)].filter(Boolean)
      : this.registry.list();
    return depts.flatMap((d) => d!.managers);
  }

  discoverDirector(
    departmentId: string,
  ): DepartmentDirectorContract | null {
    this.ensureBootstrapped();
    return this.registry.find(departmentId)?.director ?? null;
  }
}

export function createDepartmentSDK(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): DepartmentSDK {
  return new DepartmentSDK(repoRoot, opts);
}
