/**
 * CLI: npm run aios:release
 *
 * Examples:
 *   npm run aios:release -- --export-package-id=exp-... --request
 *   npm run aios:release -- --export-package-id=exp-... --plan
 *   npm run aios:release -- --export-package-id=exp-... --approve --confirm=RELEASE_TO_STUDIOSISLAB
 */
import {
  approveAndExecuteRelease,
  buildPublicationPlan,
  getReleaseStatus,
  requestRelease,
} from "./FounderReleaseController.js";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = process.env.SOS_AIOS_LIVE === "1" ? "1" : "0";
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error(JSON.stringify({ ok: false, error: "LIVE must be OFF" }));
    process.exit(1);
  }

  const export_package_id = arg("export-package-id");
  const candidate_id = arg("candidate-id");
  if (!export_package_id && !candidate_id) {
    console.error(
      "Usage: npm run aios:release -- --export-package-id=<id> [--plan|--request|--approve --confirm=RELEASE_TO_STUDIOSISLAB]",
    );
    process.exit(1);
  }

  if (flag("plan") || flag("status")) {
    if (flag("plan")) {
      console.log(
        JSON.stringify(
          buildPublicationPlan({ export_package_id, candidate_id }),
          null,
          2,
        ),
      );
    } else {
      console.log(
        JSON.stringify(
          getReleaseStatus({ export_package_id, candidate_id }),
          null,
          2,
        ),
      );
    }
    return;
  }

  if (flag("request")) {
    console.log(
      JSON.stringify(
        requestRelease({ export_package_id, candidate_id, actor: "cli" }),
        null,
        2,
      ),
    );
    return;
  }

  if (flag("approve")) {
    const confirm = arg("confirm") ?? "";
    const result = await approveAndExecuteRelease({
      export_package_id,
      candidate_id,
      founder_name: arg("founder-name") ?? "Stephen",
      explicit_approval: true,
      confirm_phrase: confirm,
      confirm_dialog: true,
      actor: "cli",
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.error("Specify --plan, --status, --request, or --approve");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
