/**
 * Editor Compatibility Certification verify — Agent #129
 */
import { runEditorCompatibilityCertification } from "./runCertification.js";

async function main() {
  const result = await runEditorCompatibilityCertification();
  console.log("Editor Compatibility Certification");
  console.log("==================================");
  for (const [k, v] of Object.entries(result.gateChecks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log("");
  console.log(`Score: ${result.score}/100`);
  console.log(`Failures: ${result.failures.length}`);
  console.log(`Overall: ${result.overall ? "PASS" : "FAIL"}`);
  if (!result.overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
