import { Resend } from "resend";
import type { RuntimeConfig } from "../config.js";
import { assertEmailConfigured } from "../config.js";
import type { EventEnvelope } from "../types.js";

export type EmailSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEmailHtml(event: EventEnvelope): string {
  const evidence =
    event.evidence?.length ?
      `<h3>Evidence</h3><ul>${event.evidence.map((e) => `<li><code>${escapeHtml(e)}</code></li>`).join("")}</ul>`
    : "";

  const approval = event.requires_approval ?
    `<p><strong>Approval:</strong> ${escapeHtml(event.approval_status)}</p>`
  : "";

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;">
  <h2>[${escapeHtml(event.priority)}] ${escapeHtml(event.title)}</h2>
  <p style="color: #666;"><em>${escapeHtml(event.type)} · ${escapeHtml(event.agent)}</em></p>
  <div>${escapeHtml(event.body).replace(/\n/g, "<br>")}</div>
  ${approval}
  ${evidence}
  <hr>
  <p style="font-size: 12px; color: #888;">Event ID: ${escapeHtml(event.event_id)}</p>
</body>
</html>`;
}

/**
 * Sends SOS notification email via Resend.
 * Mirrors the StudiosisLab sendEmail pattern but uses SOS-specific from/to env vars.
 * Does not import from src/ — isolated runtime.
 */
export async function sendEmail(
  config: RuntimeConfig,
  event: EventEnvelope,
): Promise<EmailSendResult> {
  assertEmailConfigured(config);

  if (config.dryRun) {
    return { ok: true, messageId: "dry-run" };
  }

  const resend = new Resend(config.resendApiKey!);

  try {
    const response = await resend.emails.send({
      from: config.notifyFrom,
      to: [config.notifyTo!],
      subject: `[SOS ${event.priority}] ${event.title}`,
      html: formatEmailHtml(event),
    });

    if (response.error) {
      return {
        ok: false,
        error: response.error.message || "Resend email send failed.",
      };
    }

    const messageId =
      response.data && typeof response.data === "object" && "id" in response.data ?
        String((response.data as { id?: string }).id ?? "")
      : null;

    return { ok: true, messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email send failed.";
    return { ok: false, error: message };
  }
}

export async function sendTestEmail(
  config: RuntimeConfig,
  subject: string,
  html: string,
): Promise<EmailSendResult> {
  assertEmailConfigured(config);

  if (config.dryRun) {
    return { ok: true, messageId: "dry-run" };
  }

  const resend = new Resend(config.resendApiKey!);

  try {
    const response = await resend.emails.send({
      from: config.notifyFrom,
      to: [config.notifyTo!],
      subject,
      html,
    });

    if (response.error) {
      return {
        ok: false,
        error: response.error.message || "Resend email send failed.",
      };
    }

    const messageId =
      response.data && typeof response.data === "object" && "id" in response.data ?
        String((response.data as { id?: string }).id ?? "")
      : null;

    return { ok: true, messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email send failed.";
    return { ok: false, error: message };
  }
}
