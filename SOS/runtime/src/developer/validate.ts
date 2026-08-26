import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type CommandResult = {
  passed: boolean;
  duration_ms: number;
  output: string;
  skipped?: boolean;
  reason?: string;
};

export type ValidationResult = {
  build: CommandResult;
  lint: CommandResult;
  test: CommandResult;
  execution_duration_ms: number;
  warnings: string[];
  failures: string[];
  all_passed: boolean;
};

function runCommand(cwd: string, command: string, timeoutMs: number): CommandResult {
  const start = Date.now();
  try {
    const output = execSync(command, {
      cwd,
      stdio: "pipe",
      timeout: timeoutMs,
      encoding: "utf8",
    });
    return {
      passed: true,
      duration_ms: Date.now() - start,
      output: output.slice(-4000),
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    return {
      passed: false,
      duration_ms: Date.now() - start,
      output: output.slice(-4000),
    };
  }
}

function hasTestScript(repoRoot: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return Boolean(pkg.scripts?.test);
  } catch {
    return false;
  }
}

function runScopedLint(repoRoot: string, changedFiles: string[]): CommandResult {
  const lintable = changedFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f));
  if (lintable.length === 0) {
    return {
      passed: true,
      duration_ms: 0,
      output: "No lintable source files changed",
      skipped: true,
      reason: "no ts/tsx files in change set",
    };
  }

  const paths = lintable.map((f) => `"${f}"`).join(" ");
  return runCommand(repoRoot, `npx eslint ${paths}`, 120_000);
}

export async function runFounderFileValidation(
  repoRoot: string,
  changedFiles: string[],
): Promise<ValidationResult> {
  const start = Date.now();
  const warnings: string[] = ["Founder file task — skipped full build/lint/test"];
  const failures: string[] = [];

  for (const file of changedFiles) {
    if (!existsSync(join(repoRoot, file))) {
      failures.push(`missing file: ${file}`);
    }
  }

  const skipped: CommandResult = {
    passed: true,
    duration_ms: 0,
    output: "Skipped for SOS founder file write",
    skipped: true,
    reason: "founder_file_task",
  };

  return {
    build: skipped,
    lint: skipped,
    test: skipped,
    execution_duration_ms: Date.now() - start,
    warnings,
    failures,
    all_passed: failures.length === 0,
  };
}

export async function runProjectValidation(
  repoRoot: string,
  changedFiles: string[] = [],
): Promise<ValidationResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const failures: string[] = [];

  const build = runCommand(repoRoot, "npm run build", 300_000);
  if (!build.passed) failures.push("build failed");

  const lint =
    changedFiles.length > 0
      ? runScopedLint(repoRoot, changedFiles)
      : runCommand(repoRoot, "npm run lint", 120_000);
  if (!lint.passed && !lint.skipped) failures.push("lint failed");

  let test: CommandResult;
  if (hasTestScript(repoRoot)) {
    test = runCommand(repoRoot, "npm test", 180_000);
    if (!test.passed) failures.push("test failed");
  } else {
    test = {
      passed: true,
      duration_ms: 0,
      output: "",
      skipped: true,
      reason: "no test script in package.json",
    };
    warnings.push("test script not configured — skipped");
  }

  if (!existsSync(join(repoRoot, "package.json"))) {
    failures.push("package.json not found");
  }

  const execution_duration_ms = Date.now() - start;
  const all_passed = build.passed && lint.passed && (test.skipped || test.passed);

  return {
    build,
    lint,
    test,
    execution_duration_ms,
    warnings,
    failures,
    all_passed,
  };
}
