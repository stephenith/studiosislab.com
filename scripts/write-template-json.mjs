// scripts/write-template-json.mjs
// Usage:
//   node scripts/write-template-json.mjs t003 --stdin < /path/to/t003.json
//   cat /path/to/t003.json | node scripts/write-template-json.mjs t003 --stdin
//
// Writes the provided JSON into src/data/templates/<templateKey>.json
// Uses stable formatting (2 spaces).

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/write-template-json.mjs t003 --stdin");
  process.exit(1);
}

const templateKey = args[0];
const useStdin = args.includes("--stdin");

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  let raw = "";
  if (useStdin) {
    raw = await readStdin();
  } else if (args[1]) {
    raw = fs.readFileSync(args[1], "utf8");
  } else {
    console.error("No JSON input. Use --stdin or provide a file path.");
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error("Invalid JSON input:", err?.message || err);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "src/data/templates");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${templateKey}.json`);
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
