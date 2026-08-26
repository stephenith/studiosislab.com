import { spawn, execFile } from "node:child_process";
import { existsSync, constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type CursorAgentDiscovery = {
  cursor_bin: string | null;
  cursor_agent_bin: string | null;
  cursor_agent_version: string | null;
  auth_status: "logged_in" | "not_logged_in" | "unknown";
  auth_detail: string;
  supports_headless_print: boolean;
  discovered_at: string;
};

export type CursorAgentRunResult = {
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  error: string | null;
};

const CURSOR_AGENT_CANDIDATES = [
  join(homedir(), ".local", "bin", "cursor-agent"),
  "/usr/local/bin/cursor-agent",
];

const CURSOR_CANDIDATES = ["/usr/local/bin/cursor", "/opt/homebrew/bin/cursor"];

async function isExecutable(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return existsSync(path);
  }
}

function resolveViaWhich(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("sh", ["-lc", `command -v ${command} 2>/dev/null`], (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const line = stdout.trim().split("\n")[0]?.trim();
      resolve(line || null);
    });
  });
}

async function resolveFirstExecutable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

async function resolveCursorBin(): Promise<string | null> {
  const fromList = await resolveFirstExecutable(CURSOR_CANDIDATES);
  if (fromList) return fromList;
  return resolveViaWhich("cursor");
}

async function resolveCursorAgentBin(): Promise<string | null> {
  const fromList = await resolveFirstExecutable(CURSOR_AGENT_CANDIDATES);
  if (fromList) return fromList;
  return resolveViaWhich("cursor-agent");
}

function runCommand(
  bin: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<{ exit_code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: options?.cwd,
      env: options?.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (options?.timeoutMs) {
      timer = setTimeout(() => {
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exit_code: code, stdout, stderr });
    });
  });
}

export async function discoverCursorAgentCli(): Promise<CursorAgentDiscovery> {
  const cursorBin = await resolveCursorBin();
  const cursorAgentBin = await resolveCursorAgentBin();

  let version: string | null = null;
  let authStatus: CursorAgentDiscovery["auth_status"] = "unknown";
  let authDetail = "not checked";

  const versionBin = cursorBin ?? cursorAgentBin;
  if (versionBin) {
    try {
      const versionArgs = cursorBin ? ["agent", "--version"] : ["--version"];
      const versionRun = await runCommand(versionBin, versionArgs, { timeoutMs: 15_000 });
      version = versionRun.stdout.trim() || versionRun.stderr.trim() || null;
    } catch {
      version = null;
    }
  }

  if (cursorBin) {
    try {
      const statusRun = await runCommand(cursorBin, ["agent", "status"], { timeoutMs: 15_000 });
      const combined = `${statusRun.stdout}\n${statusRun.stderr}`.trim();
      authDetail = combined || "empty status output";
      if (/not logged in/i.test(combined)) authStatus = "not_logged_in";
      else if (/logged in|email/i.test(combined)) authStatus = "logged_in";
    } catch (e) {
      authDetail = e instanceof Error ? e.message : String(e);
    }
  }

  if (process.env.CURSOR_API_KEY?.trim()) {
    authStatus = "logged_in";
    authDetail = "CURSOR_API_KEY environment variable is set";
  }

  return {
    cursor_bin: cursorBin,
    cursor_agent_bin: cursorAgentBin,
    cursor_agent_version: version,
    auth_status: authStatus,
    auth_detail: authDetail,
    supports_headless_print: Boolean(cursorBin || cursorAgentBin),
    discovered_at: new Date().toISOString(),
  };
}

export function isCursorAgentReady(discovery: CursorAgentDiscovery): boolean {
  if (!discovery.supports_headless_print) return false;
  if (discovery.auth_status === "logged_in") return true;
  if (process.env.CURSOR_API_KEY?.trim()) return true;
  return false;
}

export async function runCursorAgentPrompt(options: {
  workspace: string;
  prompt: string;
  force?: boolean;
  outputFormat?: "text" | "json" | "stream-json";
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<CursorAgentRunResult> {
  const discovery = await discoverCursorAgentCli();
  const bin = discovery.cursor_bin ?? discovery.cursor_agent_bin;
  if (!bin) {
    return {
      ok: false,
      exit_code: null,
      stdout: "",
      stderr: "",
      duration_ms: 0,
      error: "cursor agent CLI not found on PATH",
    };
  }

  if (!isCursorAgentReady(discovery)) {
    return {
      ok: false,
      exit_code: 1,
      stdout: "",
      stderr: discovery.auth_detail,
      duration_ms: 0,
      error: "Authentication required. Run `cursor agent login` or set CURSOR_API_KEY.",
    };
  }

  const args =
    discovery.cursor_bin
      ? [
          "agent",
          "--print",
          "--trust",
          "--workspace",
          options.workspace,
          "--output-format",
          options.outputFormat ?? "text",
        ]
      : [
          "--print",
          "--trust",
          "--workspace",
          options.workspace,
          "--output-format",
          options.outputFormat ?? "text",
        ];

  if (options.force) args.push("--force");
  args.push(options.prompt);

  const started = Date.now();
  try {
    const run = await runCommand(bin, args, {
      cwd: options.workspace,
      env: options.env,
      timeoutMs: options.timeoutMs,
    });
    const duration_ms = Date.now() - started;
    const ok = run.exit_code === 0;
    return {
      ok,
      exit_code: run.exit_code,
      stdout: run.stdout,
      stderr: run.stderr,
      duration_ms,
      error: ok ? null : run.stderr.trim() || `cursor agent exited with code ${run.exit_code}`,
    };
  } catch (e) {
    return {
      ok: false,
      exit_code: null,
      stdout: "",
      stderr: "",
      duration_ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
