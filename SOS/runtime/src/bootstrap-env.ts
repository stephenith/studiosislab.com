import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(runtimeRoot, ".env");

let loaded = false;

/** Load SOS/runtime/.env before any config reads. Idempotent. */
export function bootstrapEnv(): void {
  if (loaded) return;
  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true });
  }
  loaded = true;
}

bootstrapEnv();
