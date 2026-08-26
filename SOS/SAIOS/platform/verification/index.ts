/**
 * BaseVerificationHarness — Agent #173.
 * Shared assert + check aggregation for verify scripts.
 */
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

export class BaseVerificationHarness {
  readonly checks: Record<string, boolean> = {};

  check(name: string, cond: boolean): void {
    this.checks[name] = cond;
    assert(cond, `check failed: ${name}`);
  }

  mark(name: string, cond = true): void {
    this.checks[name] = cond;
  }

  allPassed(): boolean {
    return Object.values(this.checks).every(Boolean);
  }

  report(component: string): {
    pass: boolean;
    component: string;
    checks: Record<string, boolean>;
    overall: "PASS" | "FAIL";
  } {
    const pass = this.allPassed();
    return {
      pass,
      component,
      checks: this.checks,
      overall: pass ? "PASS" : "FAIL",
    };
  }

  finish(component: string): void {
    const out = this.report(component);
    console.log(JSON.stringify(out, null, 2));
    if (!out.pass) process.exit(1);
  }
}

export { BaseArtifactBuilder } from "./BaseArtifactBuilder.js";
export type { ArtifactBuildResult } from "./BaseArtifactBuilder.js";
