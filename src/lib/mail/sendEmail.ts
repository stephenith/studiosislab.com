import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
}) {

  console.log("EMAIL FUNCTION CALLED");
  console.log("Sending email to:", to);

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is missing in environment variables");
    return;
  }

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

    console.log("EMAIL SENT SUCCESSFULLY");
    console.log("Resend response:", response);

    return response;

  } catch (error) {
    console.error("EMAIL SENDING FAILED");
    console.error(error);
  }
}