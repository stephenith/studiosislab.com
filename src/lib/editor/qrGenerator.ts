export async function generateQrDataUrl(content: string): Promise<string> {
  const QRCode = await import("qrcode");

  return QRCode.toDataURL(content, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
