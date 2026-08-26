/**
 * CLI: npm run aios:export-status -- --candidate-id=<id>
 *   or: npm run aios:export-status -- --staging-package-id=<id>
 */
import { getExportStatus } from "./ExportService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function main(): void {
  const candidateId = arg("candidate-id");
  const stagingPackageId = arg("staging-package-id");
  if (!candidateId && !stagingPackageId) {
    console.error(
      "Usage: npm run aios:export-status -- --candidate-id=<id> | --staging-package-id=<id>",
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      getExportStatus({
        candidate_id: candidateId,
        staging_package_id: stagingPackageId,
      }),
      null,
      2,
    ),
  );
}

main();
