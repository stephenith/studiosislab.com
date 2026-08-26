/**
 * DepartmentRegistry — discover/register departments (Agent #180).
 * No runtime activation. Contracts only.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  DepartmentContract,
  DepartmentLifecycleStatus,
  DepartmentRegistryHealth,
  DepartmentRegistrySnapshot,
  DepartmentSummary,
} from "./DepartmentTypes.js";
import {
  DEPARTMENT_REGISTRY_HEALTH_VERSION,
  DEPARTMENT_REGISTRY_SNAPSHOT_VERSION,
  DEPARTMENT_SDK_SAFETY_FLAGS,
} from "./DepartmentTypes.js";
import { Department } from "./Department.js";
import { validateDepartment } from "./DepartmentValidator.js";
import {
  assertDepartmentLifecycleTransition,
} from "./DepartmentLifecycle.js";

const LOG_REL = "SOS/07_LOGS/saios/platform/department-sdk";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class DepartmentRegistry {
  readonly root: string;
  readonly fixture: boolean;
  private readonly byId = new Map<string, DepartmentContract>();

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.fixture = Boolean(opts?.fixture);
  }

  get dir(): string {
    const base = join(this.root, LOG_REL);
    return this.fixture ? join(base, "fixtures") : base;
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  register(dept: DepartmentContract): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const validation = validateDepartment(dept);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.errors[0]?.message ?? "validation failed",
      };
    }
    if (this.byId.has(dept.department_id)) {
      return {
        ok: false,
        error: `Department already registered: ${dept.department_id}`,
      };
    }
    this.byId.set(dept.department_id, {
      ...dept,
      status: dept.status === "REGISTERED" ? "REGISTERED" : dept.status,
      updated_at: new Date().toISOString(),
    });
    this.persist();
    return { ok: true };
  }

  unregister(departmentId: string): boolean {
    const removed = this.byId.delete(departmentId);
    if (removed) this.persist();
    return removed;
  }

  validate(departmentId: string): {
    ok: boolean;
    errors: string[];
    status?: DepartmentLifecycleStatus;
  } {
    const dept = this.byId.get(departmentId);
    if (!dept) {
      return { ok: false, errors: ["Department not found"] };
    }
    const result = validateDepartment(dept);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors.map((e) => e.message),
        status: dept.status,
      };
    }
    if (dept.status === "REGISTERED") {
      assertDepartmentLifecycleTransition("REGISTERED", "VALIDATED");
      this.byId.set(departmentId, {
        ...dept,
        status: "VALIDATED",
        updated_at: new Date().toISOString(),
        next_safe_action:
          "Validated · may advance to READY (contracts only) · execution remains impossible",
      });
      this.persist();
    }
    return {
      ok: true,
      errors: [],
      status: this.byId.get(departmentId)?.status,
    };
  }

  /** Advance REGISTERED/VALIDATED → READY (still no execution). */
  markReady(departmentId: string): { ok: boolean; error?: string } {
    const dept = this.byId.get(departmentId);
    if (!dept) return { ok: false, error: "Department not found" };
    const v = validateDepartment(dept);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message };
    }
    let from = dept.status;
    if (from === "REGISTERED") {
      this.validate(departmentId);
      from = this.byId.get(departmentId)!.status;
    }
    if (from !== "VALIDATED" && from !== "READY") {
      return {
        ok: false,
        error: `Cannot mark ready from ${from}`,
      };
    }
    if (from === "VALIDATED") {
      assertDepartmentLifecycleTransition("VALIDATED", "READY");
    }
    this.byId.set(departmentId, {
      ...this.byId.get(departmentId)!,
      status: "READY",
      updated_at: new Date().toISOString(),
      next_safe_action:
        "READY · contracts only · STOP — ACTIVE is metadata; execution remains impossible",
    });
    this.persist();
    return { ok: true };
  }

  discover(): DepartmentSummary[] {
    return this.list().map((d) => {
      const v = validateDepartment(d);
      return {
        department_id: d.department_id,
        department_name: d.department_name,
        department_type: d.department_type,
        version: d.version,
        status: d.status,
        director_id: d.director.director_id,
        manager_count: d.managers.length,
        worker_count: d.workers.length,
        capability_count: d.capabilities.length,
        reference: d.reference,
        placeholder: d.placeholder,
        validation_ok: v.ok,
      };
    });
  }

  list(): DepartmentContract[] {
    return [...this.byId.values()].sort((a, b) =>
      a.department_id.localeCompare(b.department_id),
    );
  }

  find(departmentId: string): DepartmentContract | null {
    return this.byId.get(departmentId) ?? null;
  }

  load(departmentId: string): Department | null {
    const c = this.find(departmentId);
    return c ? new Department(c) : null;
  }

  persist(): void {
    this.ensureDir();
    const list = this.list();
    writeFileSync(
      join(this.dir, "departments.json"),
      JSON.stringify(list, null, 2),
      "utf8",
    );
    const snapshot = this.buildSnapshot();
    writeFileSync(
      join(this.dir, "latest-department-registry-snapshot.json"),
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
    const health = this.buildHealth();
    writeFileSync(
      join(this.dir, "department-registry-health.json"),
      JSON.stringify(health, null, 2),
      "utf8",
    );
  }

  loadPersisted(): number {
    const path = join(this.dir, "departments.json");
    if (!existsSync(path)) return 0;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as DepartmentContract[];
      this.byId.clear();
      for (const d of raw) {
        this.byId.set(d.department_id, d);
      }
      return this.byId.size;
    } catch {
      return 0;
    }
  }

  buildSnapshot(): DepartmentRegistrySnapshot {
    const list = this.list();
    const reference = list.find((d) => d.reference) ?? null;
    return {
      schema_version: DEPARTMENT_REGISTRY_SNAPSHOT_VERSION,
      updated_at: new Date().toISOString(),
      department_count: list.length,
      validated_count: list.filter((d) =>
        ["VALIDATED", "READY", "ACTIVE"].includes(d.status),
      ).length,
      ready_count: list.filter((d) => d.status === "READY").length,
      placeholder_count: list.filter((d) => d.placeholder).length,
      reference_department_id: reference?.department_id ?? null,
      department_ids: list.map((d) => d.department_id),
      next_safe_action:
        "Department registry · contracts only · execution remains impossible · LIVE OFF",
      safety_flags: DEPARTMENT_SDK_SAFETY_FLAGS,
    };
  }

  buildHealth(): DepartmentRegistryHealth {
    const list = this.list();
    const count = (s: DepartmentLifecycleStatus) =>
      list.filter((d) => d.status === s).length;
    return {
      schema_version: DEPARTMENT_REGISTRY_HEALTH_VERSION,
      updated_at: new Date().toISOString(),
      registered_count: count("REGISTERED"),
      validated_count: count("VALIDATED"),
      ready_count: count("READY"),
      active_count: count("ACTIVE"),
      paused_count: count("PAUSED"),
      disabled_count: count("DISABLED"),
      status: list.length ? "healthy" : "idle",
      mode: "department_sdk_contracts_only",
      safety_flags: DEPARTMENT_SDK_SAFETY_FLAGS,
      live: false,
    };
  }

  loadSnapshot(): DepartmentRegistrySnapshot | null {
    const path = join(this.dir, "latest-department-registry-snapshot.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as DepartmentRegistrySnapshot;
    } catch {
      return null;
    }
  }

  loadHealth(): DepartmentRegistryHealth | null {
    const path = join(this.dir, "department-registry-health.json");
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as DepartmentRegistryHealth;
    } catch {
      return null;
    }
  }
}
