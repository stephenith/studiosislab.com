/** Canonical founder instruction — single source of truth for INBOX-EXEC tasks. */

export const FOUNDER_INSTRUCTION_HEADING = "Founder instruction";

export function extractFounderInstructionFromMarkdown(content: string): string | undefined {
  const block = content.match(
    new RegExp(`## ${FOUNDER_INSTRUCTION_HEADING}\\s*\\n+([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"),
  );
  const text = block?.[1]?.trim();
  return text || undefined;
}

export function formatFounderInstructionSection(instruction: string): string {
  return `## ${FOUNDER_INSTRUCTION_HEADING}\n${instruction}\n`;
}

export function founderInstructionFromTaskMetadata(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const raw = metadata?.founder_instruction;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}
