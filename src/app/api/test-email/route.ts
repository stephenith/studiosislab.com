import { sendEmail } from "@/lib/mail/sendEmail";

export async function GET() {
  try {
    await sendEmail({
      to: "pstephen027@gmail.com",
      subject: "StudiosisLab Email Test",
      html: "<h1>Email system working!</h1>",
    });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email test failed";
    return Response.json({ success: false, error: message });
  }
}