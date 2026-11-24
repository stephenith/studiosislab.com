/**
 * Catalog template image sources must use loadable Iconify paths.
 * Run: npx tsx src/lib/editor/templateImageSrc.verify.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { rewriteTemplateImageSrc } from "./templateImageSrc";

assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion%3Acall.svg"),
  "https://api.iconify.design/ion/call.svg"
);
assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion:call.svg"),
  "https://api.iconify.design/ion/call.svg"
);
assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion/call.svg"),
  "https://api.iconify.design/ion/call.svg"
);
assert.equal(rewriteTemplateImageSrc("/templates/t004.png"), "/templates/t004.png");
assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion/call.svg?color=%23fff"),
  "https://api.iconify.design/ion/call.svg?color=%23fff"
);
assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion%3Acall.svg?color=red"),
  "https://api.iconify.design/ion/call.svg?color=red"
);
assert.equal(
  rewriteTemplateImageSrc("https://cdn.iconify.design/ion:call.svg"),
  "https://cdn.iconify.design/ion:call.svg"
);
assert.equal(
  rewriteTemplateImageSrc("https://example.com/ion%3Acall.svg"),
  "https://example.com/ion%3Acall.svg"
);
assert.equal(
  rewriteTemplateImageSrc("https://api.iconify.design/ion%2Fcall.svg"),
  "https://api.iconify.design/ion%2Fcall.svg"
);

const broken = new RegExp("https://api\\.iconify\\.design/[^\"\\\\]*?(?:%3A|:)", "i");
const jsonDir = path.join(__dirname, "../../data/template-json");
const registry = readFileSync(
  path.join(__dirname, "../../data/systemTemplates/registry.generated.ts"),
  "utf8"
);
const ids = [...registry.matchAll(/id: "(t\d+)"/g)].map((match) => match[1]);
assert.ok(ids.length >= 80);

const remaining: string[] = [];
for (const id of ids) {
  const file = path.join(jsonDir, `${id}.json`);
  const text = readFileSync(file, "utf8");
  if (broken.test(text)) remaining.push(id);
}
assert.deepEqual(remaining, []);

const listed = new Set(readdirSync(jsonDir).filter((name) => /^t\d+\.json$/.test(name)));
for (const id of ids) {
  assert.equal(listed.has(`${id}.json`), true, `missing ${id}.json`);
}

const mobileSanitize = readFileSync(path.join(__dirname, "mobileEditorUtils.ts"), "utf8");
const desktopSanitize = readFileSync(
  path.join(__dirname, "../../components/editor/useFabricEditor.ts"),
  "utf8"
);
assert.match(mobileSanitize, /rewriteTemplateImageSrc/);
assert.match(desktopSanitize, /rewriteTemplateImageSrc/);

console.log("templateImageSrc.verify: PASS");
