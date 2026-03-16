export async function sendSignatureEmail(email: string, link: string) {
    try {
      const res = await fetch("/api/esign/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toEmail: email,
          documentLink: link,
        }),
      });
  
      return await res.json();
    } catch (error) {
      console.error("Email send failed:", error);
    }
  }