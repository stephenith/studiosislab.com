import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/mail/sendEmail";

export const runtime = "nodejs";

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
} catch {
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
const { uid } = decoded;

const body = await req.json();
const { documentId, senderEmail, clientEmail, message } = body || {};

if (!documentId || !senderEmail || !clientEmail) {
return new Response(
JSON.stringify({
ok: false,
error: "documentId, senderEmail and clientEmail are required",
}),
{
status: 400,
headers: { "Content-Type": "application/json" },
}
);
}

const docRef = adminDb.collection("esign_documents").doc(documentId);
const snap = await docRef.get();

if (!snap.exists) {
return new Response(
JSON.stringify({ ok: false, error: "Document not found" }),
{
status: 404,
headers: { "Content-Type": "application/json" },
}
);
}

const data = snap.data() as any;
const ownerUid = data.ownerUid;

if (!ownerUid || ownerUid !== uid) {
return new Response(
JSON.stringify({
ok: false,
error: "You are not allowed to invite for this document",
}),
{
status: 403,
headers: { "Content-Type": "application/json" },
}
);
}

const inviteId = crypto.randomUUID();
const token = crypto.randomUUID();

const now = new Date();
const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

const inviteRef = docRef.collection("invites").doc(inviteId);

await inviteRef.set({
token,
senderUid: uid,
senderEmail,
clientEmail,
message: message ?? "",
status: "sent",
createdAt: now,
updatedAt: now,
expiresAt,
viewedAt: null,
completedAt: null,
recipientUid: null,
recipientEmail: null,
});

await docRef.set(
{
countersignStatus: "sent",
},
{ merge: true }
);

// Generate signing link
const url = `/tools/esign/${documentId}?token=${encodeURIComponent(token)}`;

const baseUrl = "http://localhost:3000";

const signingLink = `${baseUrl}${url}`;

const emailHtml = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:20px 24px 12px 24px;border-bottom:1px solid #e5e5e5;">
                <div style="font-size:18px;font-weight:600;color:#111827;">Studiosis Lab</div>
                <div style="margin-top:4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                  Secure Document Signature Request
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px 4px 24px;font-size:14px;color:#111827;line-height:1.5;">
                <p style="margin:0 0 12px 0;">
                  <strong>${senderEmail}</strong> has requested your signature on a document.
                </p>
                <p style="margin:0 0 12px 0;color:#4b5563;">
                  You are being asked to review and countersign a document securely using
                  Studiosis Lab's e‑signature system.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 24px 12px 24px;font-size:13px;color:#374151;line-height:1.5;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 12px;background-color:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
                      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">
                        Sent by
                      </div>
                      <div style="font-size:13px;color:#111827;">
                        ${senderEmail}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 24px 16px 24px;font-size:13px;color:#374151;line-height:1.5;">
                <p style="margin:0 0 8px 0;">
                  Once signed, a finalized copy of the agreement will automatically be delivered
                  to both parties.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 24px 24px 24px;">
                <a href="${signingLink}" style="
                  display:inline-block;
                  padding:12px 22px;
                  background-color:#16a34a;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:999px;
                  font-size:14px;
                  font-weight:600;
                ">
                  Review &amp; Sign Securely
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 20px 24px;font-size:12px;color:#374151;line-height:1.5;">
                <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">
                  Why this signing link is secure
                </div>
                <ul style="margin:6px 0 0 18px;padding:0;color:#4b5563;">
                  <li style="margin-bottom:4px;">Unique encrypted signing link</li>
                  <li style="margin-bottom:4px;">Document cannot be modified after signing</li>
                  <li style="margin-bottom:4px;">Signature permanently embedded into the PDF</li>
                  <li style="margin-bottom:4px;">Secure cloud storage and delivery</li>
                </ul>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 24px 18px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;line-height:1.5;">
                <div style="margin-bottom:4px;">
                  Powered by <strong>Studiosis Lab Secure E‑Signature</strong>
                </div>
                <div style="font-size:11px;color:#9ca3af;">
                  This secure link is intended only for the recipient. Please do not share it.
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

console.log("Sending signing email to:", clientEmail);
console.log("Signing link:", signingLink);

await sendEmail({
to: clientEmail,
subject: `Signature requested by ${senderEmail} via Studiosis Lab`,
html: emailHtml,
});

console.log("Email successfully sent.");

return new Response(
JSON.stringify({
ok: true,
url,
inviteId,
token,
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

console.error("esign invite error:", e);

return new Response(
JSON.stringify({
ok: false,
error: "Failed to create countersign invite",
}),
{
status: 500,
headers: { "Content-Type": "application/json" },
}
);
}
}