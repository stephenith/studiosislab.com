import { Resend } from "resend";

export type SendEmailResult = {
  ok: true;
  messageId: string | null;
};

/**
 * Sends transactional email via Resend.
 * Throws on misconfiguration or delivery failure (callers should map to HTTP errors).
 * Never logs recipients, links, tokens, or full payloads.
 */
export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);

  try {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: "StudiosisLab <business@studiosis.in>",
      to: [to],
      subject,
      html,
    };
    if (attachments?.length) {
      payload.attachments = attachments;
    }
    const response = await resend.emails.send(payload);

    if (response.error) {
      throw new Error(response.error.message || "Resend email send failed.");
    }

    const messageId =
      response.data && typeof response.data === "object" && "id" in response.data
        ? String((response.data as { id?: string }).id ?? "")
        : null;

    return { ok: true, messageId: messageId || null };
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Email send failed.");
  }
}
