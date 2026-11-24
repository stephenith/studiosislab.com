/**
 * Phone resume load mapping.
 * Run: node src/lib/editor/mobileResumeLoad.verify.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeToFabricJson } from "./fabricJson";
import {
  PHONE_RESUME_LOAD_MESSAGES,
  classifyPhoneResumeLoadError,
  loadOwnedResumeWithAuthRetry,
  loadPublishedTemplateJson,
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
const arrayPage = unwrapTemplateSnapshot([{ version: "6.9.1", objects: [{ type: "textbox", text: "Array" }] }]);
assert.deepEqual(normalizeToFabricJson(arrayPage).objects[0], { type: "textbox", text: "Array" });

const safari = classifyPhoneResumeLoadError(new Error("Load failed"));
assert.equal(safari.reason, "invalid_template_json");
const chunk = classifyPhoneResumeLoadError({ name: "ChunkLoadError", message: "Loading chunk 12 failed" });
assert.equal(chunk.reason, "invalid_template_json");

let loads = 0;
const recovered = await loadPublishedTemplateJson(async () => {
  loads += 1;
  if (loads === 1) throw new Error("Load failed");
  return { objects: [{ type: "rect" }] };
});
assert.equal(loads, 2);
assert.deepEqual(recovered, { objects: [{ type: "rect" }] });

let fabricLoads = 0;
await assert.rejects(
  () =>
    loadPublishedTemplateJson(async () => {
      fabricLoads += 1;
      throw new Error("Invalid template JSON: expected { objects: [] }");
    }),
  /Invalid template JSON/
);
assert.equal(fabricLoads, 1);

const hook = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"),
  "utf8"
);
const openStart = hook.indexOf("const template = getSystemTemplateById(templateId)");
const openEnd = hook.indexOf("loadedKeyRef.current = key");
const open = hook.slice(openStart, openEnd);
assert.ok(openStart > 0 && openEnd > openStart);
assert.equal((open.match(/loadSnapshotOntoCanvas/g) || []).length, 0);
assert.match(open, /sanitizeImageSourcesForLoad/);
assert.match(open, /renderStackedPages/);
}

void main().then(() => {
  console.log("mobileResumeLoad.verify: PASS");
});
