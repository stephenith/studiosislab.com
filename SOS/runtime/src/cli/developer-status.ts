#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../load-env.js";
import { getDeveloperStatus } from "../developer/loop.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(__dirname, "../../.env"));

async function main(): Promise<void> {
  const status = await getDeveloperStatus();
  console.log(JSON.stringify(status, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
