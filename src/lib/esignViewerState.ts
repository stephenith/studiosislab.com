export type LockButtonTone = "disabled" | "lock" | "unlock";

export type LockButtonView = {
  disabled: boolean;
  label: string;
  tone: LockButtonTone;
  guidance: string | null;
};

export function lockButtonView(
  hasSelectedSignature: boolean,
  signatureLocked: boolean,
  audience: "sender" | "recipient" = "recipient"
): LockButtonView {
  if (!hasSelectedSignature) {
    if (audience === "sender") {
      return {
        disabled: true,
        label: "Select a placed signature first.",
        tone: "disabled",
        guidance: null,
      };
    }
    return {
      disabled: true,
      label: "Lock signature to continue.",
      tone: "disabled",
      guidance: "Select a placed signature first.",
    };
  }
  if (signatureLocked) {
    return {
      disabled: false,
      label: audience === "sender" ? "Unlock signature" : "Unlock Signature",
      tone: "unlock",
      guidance: null,
    };
  }
  return {
    disabled: false,
    label: "Lock signature to continue.",
    tone: "lock",
    guidance: null,
  };
}

export function lockButtonClassName(
  tone: LockButtonTone,
  audience: "sender" | "recipient" = "recipient"
): string {
  const base = "w-full rounded-lg border px-3 py-2 text-xs font-medium";
  if (tone === "lock") {
    void audience;
    return `${base} inline-flex items-center justify-center gap-2 border-green-700 bg-green-600 text-white shadow-sm hover:bg-green-700`;
  }
  if (tone === "unlock") {
    return `${base} inline-flex items-center justify-center gap-2 border-zinc-300 bg-white text-zinc-800 hover:border-blue-400`;
  }
  return `${base} cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400`;
}

export type RecipientPhase =
  | "insert"
  | "lock"
  | "invite_pending"
  | "invite_invalid"
  | "ready"
  | "completing"
  | "completed";

export type RecipientProgressInput = {
  status?: string | null;
  recipientComplete: boolean;
  recipientCompleting: boolean;
  recipientLockedSignature: boolean;
  clientSignatureInserted: boolean;
  inviteValid: boolean;
  inviteValidating: boolean;
};

export function recipientPhase(input: RecipientProgressInput): RecipientPhase {
  if (input.status === "completed" || input.recipientComplete) return "completed";
  if (input.recipientCompleting) return "completing";
  if (input.recipientLockedSignature) {
    if (input.inviteValidating || !input.inviteValid) {
      return input.inviteValidating ? "invite_pending" : "invite_invalid";
    }
    return "ready";
  }
  if (input.clientSignatureInserted) return "lock";
  return "insert";
}

export function recipientHelperText(phase: RecipientPhase): string {
  switch (phase) {
    case "insert":
      return "Insert your signature on the document.";
    case "lock":
      return "Lock your signature to continue.";
    case "invite_pending":
      return "Checking this invitation.";
    case "invite_invalid":
      return "This invitation cannot be used to complete the agreement.";
    case "ready":
      return "Your signature is locked. You can complete this agreement.";
    case "completing":
      return "Completing this agreement…";
    case "completed":
      return "Countersign complete.";
  }
}

export function recipientActionLabel(phase: RecipientPhase): string {
  if (phase === "completed") return "Agreement completed";
  if (phase === "completing") return "Completing…";
  return "Complete agreement";
}

export function recipientActionEnabled(phase: RecipientPhase): boolean {
  return phase === "ready";
}

export const PHONE_UNLOCKED_SIGNATURE_HINT =
  "Tap Lock to secure your signature and continue.";

export const PHONE_LOCKED_SENDER_HINT =
  "Signature locked. Tap Download to save the signed agreement or Share to request a countersignature.";

export const PHONE_LOCKED_RECIPIENT_HINT =
  "Signature locked. Tap Complete to finish this agreement.";

export type PhoneDockGuidance = {
  text: string;
  tone: "green" | "orange";
  arrow: "lock" | "share" | "complete";
};

export function phoneDockGuidance(input: {
  phoneLayout: boolean;
  mode: "sender" | "recipient";
  signatures: Array<{ locked?: boolean }>;
  recipientFinished?: boolean;
  senderLockedHintDismissed?: boolean;
  recipientPhase?: RecipientPhase;
}): PhoneDockGuidance | null {
  if (!input.phoneLayout || input.recipientFinished) return null;
  if (input.signatures.some((signature) => !signature.locked)) {
    return {
      text: PHONE_UNLOCKED_SIGNATURE_HINT,
      tone: "green",
      arrow: "lock",
    };
  }
  if (!input.signatures.some((signature) => signature.locked)) return null;
  if (input.mode === "sender") {
    if (input.senderLockedHintDismissed) return null;
    return {
      text: PHONE_LOCKED_SENDER_HINT,
      tone: "orange",
      arrow: "share",
    };
  }
  if (input.recipientPhase === "ready") {
    return {
      text: PHONE_LOCKED_RECIPIENT_HINT,
      tone: "orange",
      arrow: "complete",
    };
  }
  return null;
}

export const PHONE_ESIGN_HEADER_FALLBACK = "Document";

export function phoneEsignHeaderFileName(fileName?: string | null): string {
  const trimmed = typeof fileName === "string" ? fileName.trim() : "";
  return trimmed || PHONE_ESIGN_HEADER_FALLBACK;
}

export function phoneUnlockedSignatureHint(
  phoneLayout: boolean,
  signatures: Array<{ locked?: boolean }>,
  recipientFinished = false
): string | null {
  const hint = phoneDockGuidance({
    phoneLayout,
    mode: "sender",
    signatures,
    recipientFinished,
  });
  return hint?.arrow === "lock" ? hint.text : null;
}

export function esignTitleStatus(input: {
  status?: string | null;
  countersignStatus?: string | null;
  recipientComplete: boolean;
}): string {
  if (input.status === "completed" || input.recipientComplete) return "Completed";
  if (
    input.status === "waiting_countersign" ||
    input.countersignStatus === "sent"
  ) {
    return "Waiting for countersign";
  }
  if (input.status === "pending_client") return "Pending";
  return "Draft";
}
