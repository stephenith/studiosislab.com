/**
 * CLI: npm run aios:publication:status -- --export-package-id=<id>
 *   or: npm run aios:publication:status -- --candidate-id=<id>
 */
import { getPublicationReadinessStatus } from "./PublicationReadinessService.js";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function main(): void {
  const exportPackageId = arg("export-package-id");
  const candidateId = arg("candidate-id");
  if (!exportPackageId && !candidateId) {
    console.error(
      "Usage: npm run aios:publication:status -- --export-package-id=<id> | --candidate-id=<id>",
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      getPublicationReadinessStatus({
        export_package_id: exportPackageId,
        candidate_id: candidateId,
      }),
      null,
      2,
    ),
  );
}

main();
