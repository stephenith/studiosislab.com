import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toEmail, documentLink } = body;

    const data = await resend.emails.send({
      from: "Studiosis eSign <business@studiosis.in>",
      to: [toEmail],
      subject: "Document Signature Request",
      html: `
        <h2>You have received a document for signature</h2>
        <p>Please click the link below to review and sign.</p>
        <a href="${documentLink}" style="
          display:inline-block;
          padding:12px 18px;
          background:#000;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
        ">Review & Sign</a>
        <p>This link will open StudiosisLab secure signing page.</p>
      `,
    });

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}