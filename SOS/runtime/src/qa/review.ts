import type { VerificationResult } from "./types.js";

export function reviewVerification(result: VerificationResult): {
  accept: boolean;
  message: string;
} {
  if (result.verdict === "pass" && result.confidence >= 60) {
    return { accept: true, message: "Verification accepted for PM consumption" };
  }
  if (result.verdict === "blocked") {
    return { accept: false, message: "Blocked — escalate to PM" };
  }
  return { accept: false, message: "Verification failed — return to Developer via PM" };
}
