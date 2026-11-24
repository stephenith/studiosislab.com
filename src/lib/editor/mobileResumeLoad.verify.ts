/**
 * Phone resume load mapping.
 * Run: node src/lib/editor/mobileResumeLoad.verify.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeToFabricJson } from "./fabricJson";
import {
  PHONE_LOAD_ERROR_ACTION_GAP_PX,
  PHONE_LOAD_ERROR_ACTION_MIN_PX,
  PHONE_RESUME_LOAD_MESSAGES,
  classifyPhoneResumeLoadError,
  describePhoneResumeLoadFailure,
  loadOwnedResumeWithAuthRetry,
  loadPublishedTemplateJson,
  phoneLoadErrorActionRects,
  phoneResumeLoadDecision,
  phoneResumeLoadFailureLog,
  phoneResumeLoadSource,
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
assert.equal(
  phoneResumeLoadSource({
    decision: phoneResumeLoadDecision({ docId: null, authReady: true, uid: "uid-1" }),
    blank: false,
    templateId: "t012",
  }),
  "template"
);
assert.equal(
  phoneResumeLoadSource({
    decision: phoneResumeLoadDecision({ docId: null, authReady: true, uid: "uid-1" }),
    blank: true,
    templateId: "blank",
  }),
  "blank"
);
assert.equal(
  phoneResumeLoadSource({
    decision: phoneResumeLoadDecision({ docId: "doc-1", authReady: true, uid: "uid-1" }),
    blank: false,
    templateId: "t012",
  }),
  "document"
);

const narrowActions = phoneLoadErrorActionRects(280);
assert.equal(narrowActions.overlap, false);
assert.equal(narrowActions.tryAgain.width, 280);
assert.equal(narrowActions.hub.width, 280);
assert.equal(narrowActions.tryAgain.height, PHONE_LOAD_ERROR_ACTION_MIN_PX);
assert.equal(narrowActions.hub.top, PHONE_LOAD_ERROR_ACTION_MIN_PX + PHONE_LOAD_ERROR_ACTION_GAP_PX);
assert.ok(narrowActions.hub.top >= narrowActions.tryAgain.top + narrowActions.tryAgain.height);

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
  assert.equal(thrownMissing.errorCode, "not-found");
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

const typeError = describePhoneResumeLoadFailure({
  err: new TypeError("Cannot read properties of undefined"),
  stage: "hydrate_render",
  source: "document",
});
assert.equal(typeError.message, PHONE_RESUME_LOAD_MESSAGES.generic);
assert.equal(typeError.stage, "hydrate_render");
assert.equal(typeError.errorName, "TypeError");
const typeLog = phoneResumeLoadFailureLog(typeError);
assert.deepEqual(Object.keys(typeLog).sort(), ["code", "name", "reason", "source", "stage"]);
assert.equal("message" in typeLog, false);
assert.doesNotMatch(JSON.stringify(typeLog), /uid-|resume text|token/i);

const dirtyName = describePhoneResumeLoadFailure({
  err: { name: "FirebaseError", code: "unavailable", message: "Owner uid-secret resume Jane Doe" },
  stage: "document_read",
  source: "document",
});
assert.equal(dirtyName.errorCode, "unavailable");
assert.equal(dirtyName.errorName, "FirebaseError");
assert.equal(phoneResumeLoadFailureLog(dirtyName).code, "unavailable");
assert.doesNotMatch(JSON.stringify(phoneResumeLoadFailureLog(dirtyName)), /uid-secret|Jane Doe/);

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
assert.match(hook, /phoneResumeLoadFailureLog/);
assert.match(hook, /stage = "document_read"/);
assert.match(hook, /stage = "template_json"/);
assert.match(hook, /stage = "hydrate_render"/);
assert.doesNotMatch(hook, /console\.error\("\[mobile-editor\] Failed to load"/);

const reloadStart = hook.indexOf("const reloadLatest = useCallback");
const reloadEnd = hook.indexOf("useEffect(() => {\n    if (!canvasReady)", reloadStart);
const reload = hook.slice(reloadStart, reloadEnd);
assert.ok(reloadStart > 0 && reloadEnd > reloadStart);
assert.match(reload, /loadedKeyRef\.current = null/);
assert.match(reload, /setReloadNonce/);
assert.equal(/setCanvasEpoch/.test(reload), false);
assert.equal(/dispose\(/.test(reload), false);
}

void main().then(() => {
  console.log("mobileResumeLoad.verify: PASS");
});
