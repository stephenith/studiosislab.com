/**
 * Phone resume load mapping.
 * Run: node src/lib/editor/mobileResumeLoad.verify.ts
 */
import assert from "node:assert/strict";
import {
  PHONE_RESUME_LOAD_MESSAGES,
  classifyPhoneResumeLoadError,
  loadOwnedResumeWithAuthRetry,
  phoneResumeLoadDecision,
  readPhoneResumeDoc,
  unwrapTemplateSnapshot,
} from "./mobileResumeLoad";

assert.deepEqual(phoneResumeLoadDecision({ docId: "doc-1", authReady: false, uid: null }), { type: "wait" });
assert.equal(
  phoneResumeLoadDecision({ docId: "doc-1", authReady: false, uid: "uid-1" }).type,
  "wait",
  "auth still initializing must not fetch or mark the document missing"
);

const denied = phoneResumeLoadDecision({ docId: "doc-1", authReady: true, uid: null });
assert.equal(denied.type, "denied");
if (denied.type === "denied") {
  assert.equal(denied.message, PHONE_RESUME_LOAD_MESSAGES.unauthenticated);
}

const owned = phoneResumeLoadDecision({
  docId: "8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b",
  authReady: true,
  uid: "uid-1",
});
assert.deepEqual(owned, {
  type: "document",
  uid: "uid-1",
  docId: "8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b",
});
assert.deepEqual(phoneResumeLoadDecision({ docId: null, authReady: true, uid: "uid-1" }), { type: "template" });

async function main() {
const missing = await readPhoneResumeDoc({ load: async () => null });
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.equal(missing.reason, "missing");
  assert.equal(missing.message, PHONE_RESUME_LOAD_MESSAGES.missing);
}

const ownedDoc = await readPhoneResumeDoc({
  load: async () => ({ title: "Nurse", pagesData: [{ objects: [] }], sourceTemplateId: "t012" }),
});
assert.equal(ownedDoc.ok, true);
if (ownedDoc.ok) assert.equal(ownedDoc.record.sourceTemplateId, "t012");

const deniedRead = await readPhoneResumeDoc({
  load: async () => {
    throw { code: "permission-denied", message: "Missing or insufficient permissions." };
  },
});
assert.equal(deniedRead.ok, false);
if (!deniedRead.ok) {
  assert.equal(deniedRead.reason, "denied");
  assert.equal(deniedRead.message, PHONE_RESUME_LOAD_MESSAGES.denied);
}

const thrownMissing = await readPhoneResumeDoc({
  load: async () => {
    throw { code: "not-found", message: "No document to update" };
  },
});
assert.equal(thrownMissing.ok, false);
if (!thrownMissing.ok) {
  assert.equal(thrownMissing.reason, "error");
  assert.equal(thrownMissing.message, PHONE_RESUME_LOAD_MESSAGES.generic);
}

const offline = classifyPhoneResumeLoadError({ code: "unavailable", message: "Failed to get document because the client is offline." });
assert.equal(offline.reason, "error");
assert.notEqual(offline.message, PHONE_RESUME_LOAD_MESSAGES.missing);

const canvas = classifyPhoneResumeLoadError(new Error("Canvas failed to initialize"));
assert.equal(canvas.reason, "canvas");
assert.equal(canvas.message, PHONE_RESUME_LOAD_MESSAGES.canvas);

const templateJson = classifyPhoneResumeLoadError(new Error("Invalid template JSON: expected { objects: [] }"));
assert.equal(templateJson.reason, "invalid_template_json");

let refreshCount = 0;
const retried = await loadOwnedResumeWithAuthRetry({
  load: async () => {
    if (refreshCount === 0) {
      throw { code: "permission-denied", message: "Missing or insufficient permissions." };
    }
    return { title: "After token", canvasJson: { objects: [] } };
  },
  refreshAuth: async () => {
    refreshCount += 1;
  },
});
assert.equal(refreshCount, 1);
assert.equal(retried.ok, true);

assert.deepEqual(unwrapTemplateSnapshot({ objects: [{ type: "rect" }] }), { objects: [{ type: "rect" }] });
assert.deepEqual(unwrapTemplateSnapshot({ default: { objects: [{ type: "textbox" }] } }), {
  objects: [{ type: "textbox" }],
});
}

void main().then(() => {
  console.log("mobileResumeLoad.verify: PASS");
});
