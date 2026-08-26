import { spawn, execFile } from "node:child_process";
import { existsSync, constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CursorProcessResult } from "./types.js";

const CURSOR_AGENT_CANDIDATES = [
  join(homedir(), ".local", "bin", "cursor-agent"),
  "/usr/local/bin/cursor-agent",
];

const CURSOR_CANDIDATES = ["/usr/local/bin/cursor", "/opt/homebrew/bin/cursor"];

export type CursorDiscovery = {
  cursor_bin: string | null;
  cursor_agent_bin: string | null;
  cursor_agent_version: string | null;
  auth_ready: boolean;
  auth_detail: string;
};

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

function runCommand(
  bin: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<{ exit_code: number | null; stdout: string; stderr: string; launched: boolean }> {
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
      resolve({ exit_code: code, stdout, stderr, launched: true });
    });
  });
}

export async function discoverCursorCli(): Promise<CursorDiscovery> {
  const cursorBin = (await resolveFirstExecutable(CURSOR_CANDIDATES)) ?? (await resolveViaWhich("cursor"));
  const cursorAgentBin =
    (await resolveFirstExecutable(CURSOR_AGENT_CANDIDATES)) ?? (await resolveViaWhich("cursor-agent"));

  let cursor_agent_version: string | null = null;
  let auth_detail = "not checked";
  let auth_ready = Boolean(process.env.CURSOR_API_KEY?.trim());

  const versionBin = cursorBin ?? cursorAgentBin;
  if (versionBin) {
    try {
      const versionArgs = cursorBin ? ["agent", "--version"] : ["--version"];
      const versionRun = await runCommand(versionBin, versionArgs, { timeoutMs: 15_000 });
      cursor_agent_version = versionRun.stdout.trim() || versionRun.stderr.trim() || null;
    } catch {
      cursor_agent_version = null;
    }
  }

  if (cursorBin) {
    try {
      const statusRun = await runCommand(cursorBin, ["agent", "status"], { timeoutMs: 15_000 });
      const combined = `${statusRun.stdout}\n${statusRun.stderr}`.trim();
      auth_detail = combined || "empty status output";
      if (/logged in/i.test(combined)) auth_ready = true;
      if (/not logged in/i.test(combined)) auth_ready = false;
    } catch (e) {
      auth_detail = e instanceof Error ? e.message : String(e);
    }
  }

  if (process.env.CURSOR_API_KEY?.trim()) {
    auth_ready = true;
    auth_detail = "CURSOR_API_KEY environment variable is set";
  }

  return {
    cursor_bin: cursorBin,
    cursor_agent_bin: cursorAgentBin,
    cursor_agent_version,
    auth_ready,
    auth_detail,
  };
}

export type RunCursorAgentOptions = {
  workspace: string;
  prompt: string;
  force?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

/**
 * Execute `cursor agent --print` and capture stdout, stderr, exit code, duration.
 */
export async function runCursorAgentPrint(options: RunCursorAgentOptions): Promise<CursorProcessResult> {
  const discovery = await discoverCursorCli();
  const bin = discovery.cursor_bin ?? discovery.cursor_agent_bin;
  const started = Date.now();

  if (!bin) {
    return {
      launched: false,
      exit_code: null,
      stdout: "",
      stderr: "",
      duration_ms: Date.now() - started,
      cursor_bin: null,
      cursor_agent_version: discovery.cursor_agent_version,
      error: "cursor agent CLI not found on PATH",
    };
  }

  if (!discovery.auth_ready) {
    return {
      launched: false,
      exit_code: 1,
      stdout: "",
      stderr: discovery.auth_detail,
      duration_ms: Date.now() - started,
      cursor_bin: bin,
      cursor_agent_version: discovery.cursor_agent_version,
      error: "Authentication required. Run `cursor agent login` or set CURSOR_API_KEY.",
    };
  }

  const args = discovery.cursor_bin
    ? ["agent", "--print", "--trust", "--workspace", options.workspace, "--output-format", "text"]
    : ["--print", "--trust", "--workspace", options.workspace, "--output-format", "text"];

  if (options.force) args.push("--force");
  args.push(options.prompt);

  try {
    const run = await runCommand(bin, args, {
      cwd: options.workspace,
      env: options.env,
      timeoutMs: options.timeoutMs ?? 600_000,
    });
    const duration_ms = Date.now() - started;
    const ok = run.exit_code === 0;
    return {
      launched: run.launched,
      exit_code: run.exit_code,
      stdout: run.stdout,
      stderr: run.stderr,
      duration_ms,
      cursor_bin: bin,
      cursor_agent_version: discovery.cursor_agent_version,
      error: ok ? null : run.stderr.trim() || `cursor agent exited with code ${run.exit_code}`,
    };
  } catch (e) {
    return {
      launched: false,
      exit_code: null,
      stdout: "",
      stderr: "",
      duration_ms: Date.now() - started,
      cursor_bin: bin,
      cursor_agent_version: discovery.cursor_agent_version,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
