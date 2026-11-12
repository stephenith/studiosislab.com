/**
 * Phone and desktop resume-editor routing.
 * Run: node src/lib/editor/phoneEditorRoute.verify.ts
 */
import assert from "node:assert/strict";
import {
  PHONE_EDITOR_MEDIA_QUERY,
  editorHrefForViewport,
  phoneEditorHrefFromDesktopPath,
  wantsPhoneEditor,
  type PhoneEditorSignals,
} from "./phoneEditorRoute";

const DOC = "8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b";

function signals(partial: Partial<PhoneEditorSignals> & Pick<PhoneEditorSignals, "match">): PhoneEditorSignals {
  return partial;
}

const wideIphone: PhoneEditorSignals = signals({
  match: () => false,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  screenWidth: 390,
  screenHeight: 844,
  maxTouchPoints: 5,
});

const ipad: PhoneEditorSignals = signals({
  match: (query) => query === "(pointer: coarse)" || query === "(hover: none)",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
  screenWidth: 1024,
  screenHeight: 1366,
  maxTouchPoints: 5,
});

const desktop: PhoneEditorSignals = signals({
  match: () => false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  screenWidth: 1440,
  screenHeight: 900,
  maxTouchPoints: 0,
});

assert.equal(wantsPhoneEditor(wideIphone), true, "inflated iPhone layout viewport still opens the phone editor");
assert.equal(
  editorHrefForViewport({ templateId: "t012" }, wantsPhoneEditor(wideIphone)),
  "/editor/mobile/template/t012"
);
assert.equal(
  editorHrefForViewport({ templateId: "t012", docId: DOC }, wantsPhoneEditor(wideIphone)),
  `/editor/mobile/template/t012?doc=${DOC}`
);

assert.equal(wantsPhoneEditor(ipad), false, "iPad stays on the desktop editor");
assert.equal(editorHrefForViewport({ templateId: "t004" }, wantsPhoneEditor(ipad)), "/editor/template/t004");
assert.equal(editorHrefForViewport({ templateId: "t004", docId: DOC }, wantsPhoneEditor(ipad)), `/editor/doc/${DOC}`);

assert.equal(wantsPhoneEditor(desktop), false);
assert.equal(editorHrefForViewport({ templateId: "t001" }, false), "/editor/template/t001");
assert.equal(editorHrefForViewport({ docId: DOC, templateId: "t001" }, false), `/editor/doc/${DOC}`);
assert.equal(editorHrefForViewport({ blank: true }, false), "/editor/new");

assert.equal(wantsPhoneEditor((query) => query === PHONE_EDITOR_MEDIA_QUERY), true);
assert.equal(editorHrefForViewport({ blank: true }, true), "/editor/mobile/template/blank");

assert.equal(
  wantsPhoneEditor(
    signals({
      match: () => false,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      screenWidth: 980,
      screenHeight: 1200,
      maxTouchPoints: 5,
    })
  ),
  true
);
assert.equal(
  wantsPhoneEditor(
    signals({
      match: () => false,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      screenWidth: 1600,
      screenHeight: 2560,
      maxTouchPoints: 5,
    })
  ),
  false
);

assert.equal(phoneEditorHrefFromDesktopPath("/editor/template/t001"), "/editor/mobile/template/t001");
assert.equal(phoneEditorHrefFromDesktopPath("/editor/mobile/template/t001"), null);
assert.equal(phoneEditorHrefFromDesktopPath(`/editor/doc/${DOC}`), `/editor/mobile/template/resume?doc=${DOC}`);
assert.equal(phoneEditorHrefFromDesktopPath("/editor/new"), "/editor/mobile/template/blank");

console.log("phoneEditorRoute.verify: PASS");
