const APPROVAL_ID_RE = /APP-\d{8}-\d{3}/gi;

export function extractApprovalIdFromText(text: string): string | null {
  const match = text.match(/APP-\d{8}-\d{3}/i);
  if (!match) return null;
  return match[0].toUpperCase();
}

export function stripApprovalIdFromCommand(text: string): string {
  return text.replace(APPROVAL_ID_RE, "").replace(/\s+/g, " ").trim();
}
