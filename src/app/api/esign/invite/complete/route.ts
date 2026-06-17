import { NextRequest } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { getPublicAppUrl } from "@/lib/getPublicAppUrl";
import { renderEsignEmailHeader } from "@/lib/mail/esignEmailLayout";
import { sendEmail } from "@/lib/mail/sendEmail";
import { buildAuditRecord, appendAuditCertificatePage } from "@/lib/esignAudit";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const COMPLETION_EMAIL_SUBJECT = "Final signed document via StudiosisLab";

function resolveAppOrigin(req: NextRequest): string {
  try {
    return getPublicAppUrl();
  } catch {
    return req.nextUrl.origin;
  }
}

function buildCompletionDownloadUrl(appOrigin: string, documentId: string): string {
  return `${appOrigin}/api/esign/download?documentId=${encodeURIComponent(documentId)}&final=1`;
}

function collectCompletionRecipients(
  senderEmail: string,
  clientEmail: string
): Array<{ to: string; role: "Sender" | "Signer" }> {
  const seen = new Set<string>();
  const recipients: Array<{ to: string; role: "Sender" | "Signer" }> = [];

  const sender = senderEmail.trim();
  if (sender) {
    seen.add(sender.toLowerCase());
    recipients.push({ to: sender, role: "Sender" });
  }

  const client = clientEmail.trim();
  if (client && !seen.has(client.toLowerCase())) {
    recipients.push({ to: client, role: "Signer" });
  }

  return recipients;
}

async function sendCompletionEmails(params: {
  recipients: Array<{ to: string; role: "Sender" | "Signer" }>;
  documentId: string;
  docName: string;
  downloadUrl: string;
  completionIso: string;
  senderEmail: string;
  recipientEmail: string;
  verificationId: string;
  finalPdfBytes: Uint8Array;
}): Promise<void> {
  const {
    recipients,
    documentId,
    docName,
    downloadUrl,
    completionIso,
    senderEmail,
    recipientEmail,
    verificationId,
    finalPdfBytes,
  } = params;

  const includeAttachment = finalPdfBytes.length <= MAX_EMAIL_ATTACHMENT_BYTES;
  const rawName = docName || "signed-agreement";
  const baseName = rawName.replace(/\.pdf$/i, "");
  const attachmentName = `${baseName}_signed.pdf`;
  const attachments = includeAttachment
    ? [{ filename: attachmentName, content: Buffer.from(finalPdfBytes) }]
    : undefined;

  const attachmentNote = includeAttachment
    ? "A copy of the final signed PDF is attached to this email."
    : "The final signed PDF is available using the download link below.";

  const emailHtml = (recipient: string, role: "Sender" | "Signer") => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.06);">
${renderEsignEmailHeader("Final Signed Document")}
            <tr>
              <td style="padding:18px 24px 6px 24px;font-size:14px;color:#111827;line-height:1.5;">
                <p style="margin:0 0 10px 0;">
                  Your agreement <strong>${docName}</strong> has been fully signed and completed.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 24px 12px 24px;font-size:13px;color:#374151;line-height:1.5;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 12px;background-color:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
                      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">
                        Document Summary
                      </div>
                      <div style="font-size:13px;color:#111827;margin-bottom:2px;">Document ID: ${documentId}</div>
                      <div style="font-size:13px;color:#111827;margin-bottom:2px;">Sender: ${senderEmail}</div>
                      <div style="font-size:13px;color:#111827;margin-bottom:2px;">Signer: ${recipientEmail}</div>
                      <div style="font-size:13px;color:#111827;margin-bottom:2px;">Completed At: ${completionIso}</div>
                      <div style="font-size:13px;color:#111827;margin-bottom:0;">Verification ID: ${verificationId}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:6px 24px 18px 24px;">
                <a href="${downloadUrl}" style="
                  display:inline-block;
                  padding:12px 22px;
                  background-color:#111827;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:999px;
                  font-size:14px;
                  font-weight:600;
                ">
                  Download Final Signed PDF
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 18px 24px;font-size:12px;color:#374151;line-height:1.5;">
                <p style="margin:0 0 8px 0;">${attachmentNote}</p>
                <p style="margin:0;">
                  An audit certificate page has been embedded into the PDF, containing the key signing details
                  for verification purposes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;line-height:1.5;">
                <div style="margin-bottom:4px;">
                  This email was sent to ${recipient} as the ${role.toLowerCase()} of this agreement.
                </div>
                <div style="font-size:11px;color:#9ca3af;">
                  Powered by StudiosisLab secure e-sign.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  for (const { to, role } of recipients) {
    try {
      await sendEmail({
        to,
        subject: COMPLETION_EMAIL_SUBJECT,
        html: emailHtml(to, role),
        attachments,
      });
    } catch (err) {
      console.error("[esign/complete] completion email failed", {
        documentId,
        role,
        attachmentIncluded: includeAttachment,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}

type Placement = {
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked?: boolean;
};

async function getUserFromRequest(req: NextRequest) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Missing Authorization header" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded;
  } catch (e: any) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired auth token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await getUserFromRequest(req);
    const { uid, email } = decoded;

    const body = await req.json();
    const { documentId, token, placements } = body as {
      documentId: string;
      token: string;
      placements: Placement[];
    };

    if (!documentId || !token || !Array.isArray(placements)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "documentId, token and placements are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ ok: false, error: "Document not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const docData = docSnap.data() as any;
    const ownerUid = docData.ownerUid as string | undefined;

    const inviteSnap = await docRef
      .collection("invites")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (inviteSnap.empty) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const inviteDoc = inviteSnap.docs[0];
    const inviteData = inviteDoc.data() as any;

    // Ensure recipient is the one completing (or set on first completion).
    if (inviteData.recipientUid && inviteData.recipientUid !== uid) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "You are not allowed to complete this invite",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date();

    // Merge sender placements from Firestore with recipient request placements so the final PDF includes both.
    const senderPlacementsRaw = Array.isArray(docData.placements) ? docData.placements : [];
    const senderPlacements = senderPlacementsRaw.filter(
      (p: any) => p && typeof p.imageDataUrl === "string" && p.imageDataUrl.length > 0
    );
    const allPlacements = [...senderPlacements, ...placements];

    // Generate final signed PDF by reusing the existing export route.
    const origin = req.nextUrl.origin;
    const exportRes = await fetch(`${origin}/api/esign/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, placements: allPlacements }),
    });

    if (!exportRes.ok) {
      const text = await exportRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Failed to generate signed PDF: ${text || exportRes.status}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pdfArrayBuffer = await exportRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Build base audit record (hash and storage paths filled in below).
    const senderEmail: string =
      (inviteData.senderEmail as string | undefined) ||
      (docData.ownerEmail as string | undefined) ||
      "";
    // Email delivery must always target the official client email from the invite.
    const clientEmail: string =
      (inviteData.clientEmail as string | undefined) ||
      (inviteData.recipientEmail as string | undefined) ||
      "";
    // Keep the logged-in browser account email for audit/signer identity purposes.
    const recipientEmail: string =
      email || (inviteData.recipientEmail as string | undefined) || "";

    const senderIp =
      (inviteData.senderIp as string | undefined) ||
      req.headers.get("x-forwarded-for") ||
      (req as any).ip ||
      undefined;
    const recipientIp =
      req.headers.get("x-forwarded-for") || (req as any).ip || undefined;

    const audit = buildAuditRecord({
      documentId,
      inviteId: inviteDoc.id,
      senderEmail,
      recipientEmail,
      senderUid: inviteData.senderUid as string | undefined,
      recipientUid: uid,
      createdAt: inviteData.createdAt ?? null,
      senderSignedAt: inviteData.senderSignedAt ?? null,
      recipientSignedAt: now,
      completedAt: now,
      senderIp,
      recipientIp,
      signedPdfUrl: undefined,
      signedPdfPath: undefined,
    });

    // Compute hash of the base signed PDF.
    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    audit.hash = hash;

    // Append audit certificate page to create the final PDF.
    const finalPdfBytes = await appendAuditCertificatePage(pdfBuffer, audit);

    let signedPdfUrl: string | null = null;
    let signedPdfPath: string | null = null;

    if (ownerUid) {
      const filePath = `signed_esign/${ownerUid}/${documentId}/${inviteDoc.id}.pdf`;
      const file = adminStorage.file(filePath);
      await file.save(Buffer.from(finalPdfBytes), {
        contentType: "application/pdf",
      });
      signedPdfPath = filePath;
      // public URL (assuming default bucket public rules or signed URLs elsewhere)
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500",
      });
      signedPdfUrl = url;
    }

    audit.signedPdfPath = signedPdfPath ?? undefined;
    audit.signedPdfUrl = signedPdfUrl ?? undefined;

    await inviteDoc.ref.update({
      status: "completed",
      completedAt: now,
      updatedAt: now,
      recipientUid: uid,
      recipientEmail: email || inviteData.recipientEmail || null,
      signedPdfUrl: signedPdfUrl ?? null,
      signedPdfPath: signedPdfPath ?? null,
      audit,
    });

    await docRef.set(
      {
        countersignStatus: "completed",
        status: "completed",
        countersignedAt: now,
        completedAt: now,
        updatedAt: now,
        finalPdfUrl: signedPdfUrl ?? null,
        auditId: audit.auditId,
      },
      { merge: true }
    );

    // Send final signed document email to both parties (awaited; failures are logged, non-blocking).
    if (signedPdfPath) {
      const completionIso =
        now instanceof Date ? now.toISOString() : String(now ?? "");
      const docName = (docData.fileName as string | undefined) || "Document";
      const appOrigin = resolveAppOrigin(req);
      const downloadUrl = buildCompletionDownloadUrl(appOrigin, documentId);
      const recipients = collectCompletionRecipients(senderEmail, clientEmail);

      if (recipients.length > 0) {
        await sendCompletionEmails({
          recipients,
          documentId,
          docName,
          downloadUrl,
          completionIso,
          senderEmail,
          recipientEmail,
          verificationId: audit.verificationId,
          finalPdfBytes,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        signedPdfUrl,
        signedPdfPath,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    if (e instanceof Response) {
      return e;
    }
    console.error("esign invite complete error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to complete invite",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

