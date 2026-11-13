/**
 * Offline checks for signed-PDF export.
 * The sample file is read only. No Firebase, mail, or production call.
 *
 * Run: npx tsx src/lib/esignSignatureImage.verify.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from "pdf-lib";
import { buildSignedPdf, type SignaturePlacement } from "./esignSignatureImage";

const SAMPLE_PATH = process.env.ESIGN_SAMPLE_PDF?.trim() || "";
const UNRELATED_ANNOTATION = "unrelated-reused-annotation";
const MARK = [0x21, 0x96, 0xf3];

let currentStep = "setup";

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function testMarkPng(): Buffer {
  const width = 4;
  const height = 4;
  const raw = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3;
      raw[index] = MARK[0];
      raw[index + 1] = MARK[1];
      raw[index + 2] = MARK[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function markDataUrl(): string {
  return `data:image/png;base64,${testMarkPng().toString("base64")}`;
}

function placement(): SignaturePlacement {
  return {
    page: 1,
    xNorm: 0.58,
    yNorm: 0.78,
    wNorm: 0.28,
    hNorm: 0.06,
    imageDataUrl: markDataUrl(),
    locked: true,
  };
}

function readInt(buf: Buffer, start: number, width: number): number {
  let value = 0;
  for (let i = 0; i < width; i += 1) value = (value * 256) + buf[start + i];
  return value;
}

function checkIndex(buf: Buffer): { root: string; checked: number; badCount: number } {
  const text = buf.toString("latin1");
  const start = text.lastIndexOf("startxref");
  const xrefPos = Number(text.slice(start).match(/startxref\s+(\d+)/)?.[1]);
  const head = text.slice(xrefPos, xrefPos + 40);
  assert.match(head, /^\d+ \d+ obj/, "startxref does not land on an object");
  const dictEnd = text.indexOf(">>", xrefPos);
  const dict = text.slice(xrefPos, dictEnd + 2);
  const widths = dict.match(/\/W\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  assert.ok(widths, "xref stream has no /W");
  const w = [Number(widths[1]), Number(widths[2]), Number(widths[3])];
  const size = Number(dict.match(/\/Size\s+(\d+)/)?.[1]);
  const indexMatch = dict.match(/\/Index\s*\[([^\]]+)\]/);
  const pairs: Array<[number, number]> = [];
  if (indexMatch) {
    const nums = indexMatch[1].trim().split(/\s+/).map(Number);
    for (let i = 0; i < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]]);
  } else {
    pairs.push([0, size]);
  }
  const streamAt = text.indexOf("stream", xrefPos);
  let dataStart = streamAt + "stream".length;
  if (buf[dataStart] === 13 && buf[dataStart + 1] === 10) dataStart += 2;
  else if (buf[dataStart] === 10) dataStart += 1;
  const end = text.indexOf("endstream", dataStart);
  let raw = buf.subarray(dataStart, end);
  if (raw[raw.length - 1] === 10) raw = raw.subarray(0, raw.length - 1);
  if (raw[raw.length - 1] === 13) raw = raw.subarray(0, raw.length - 1);
  const data = /\/Filter\s*\/FlateDecode/.test(dict) ? inflateSync(raw) : raw;
  const entryLen = w[0] + w[1] + w[2];
  let offset = 0;
  let checked = 0;
  let badCount = 0;
  for (const [startNum, count] of pairs) {
    for (let i = 0; i < count; i += 1) {
      const num = startNum + i;
      const entry = data.subarray(offset, offset + entryLen);
      offset += entryLen;
      const type = w[0] === 0 ? 1 : readInt(entry, 0, w[0]);
      const field2 = readInt(entry, w[0], w[1]);
      const field3 = readInt(entry, w[0] + w[1], w[2]);
      if (type !== 1) continue;
      checked += 1;
      const at = buf.subarray(field2, field2 + 24).toString("latin1");
      if (!at.startsWith(`${num} ${field3} obj`)) badCount += 1;
    }
  }
  const root = dict.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  assert.ok(root, "xref stream has no root");
  return { root: `${root[1]} ${root[2]} R`, checked, badCount };
}

function streamBytes(object: PDFRawStream): Buffer {
  const raw = Buffer.from(object.getContents());
  const filter = object.dict.lookup(PDFName.of("Filter"));
  const names = filter instanceof PDFArray
    ? Array.from({ length: filter.size() }, (_, index) => String(filter.get(index)))
    : [String(filter)];
  if (!names.includes("/FlateDecode")) return raw;
  try {
    return Buffer.from(inflateSync(raw));
  } catch {
    return raw;
  }
}

async function pageText(bytes: Uint8Array): Promise<string> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as {
    getDocument: (options: { data: Uint8Array; disableWorker: boolean }) => {
      promise: Promise<{
        getPage: (pageNumber: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        }>;
      }>;
    };
  };
  const document = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
  }).promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item) => item.str ?? "").join("");
}

function hasTestMark(doc: PDFDocument): boolean {
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.lookup(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    const stream = streamBytes(object);
    for (let i = 0; i + 2 < stream.length; i += 1) {
      if (stream[i] === MARK[0] && stream[i + 1] === MARK[1] && stream[i + 2] === MARK[2]) return true;
    }
  }
  return false;
}

function annotationTexts(doc: PDFDocument): string[] {
  const texts: string[] = [];
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i += 1) {
      const value = annots.get(i);
      const object = value instanceof PDFRef ? doc.context.lookup(value) : value;
      if (!(object instanceof PDFDict)) continue;
      const contents = object.lookup(PDFName.of("Contents"));
      if (contents instanceof PDFString || contents instanceof PDFHexString) texts.push(contents.decodeText());
    }
  }
  return texts;
}

function pageAnnotRefs(doc: PDFDocument): string[] {
  const refs: string[] = [];
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i += 1) {
      const value = annots.get(i);
      if (value instanceof PDFRef) refs.push(`${value.objectNumber} ${value.generationNumber} R`);
    }
  }
  return refs;
}

type PdfObject = { num: number; gen: number; body: string };

function xrefEntry(offset: number, gen: number, kind: "n" | "f"): string {
  return `${String(offset).padStart(10, "0")} ${String(gen).padStart(5, "0")} ${kind} \n`;
}

function buildPdf(sections: Array<{ objects: PdfObject[]; root: string }>): Buffer {
  let out = Buffer.from("%PDF-1.4\n");
  const xrefPositions: number[] = [];
  for (const section of sections) {
    const written: Array<{ num: number; gen: number; offset: number }> = [];
    for (const object of section.objects) {
      const offset = out.length;
      out = Buffer.concat([
        out,
        Buffer.from(`${object.num} ${object.gen} obj\n${object.body}\nendobj\n`),
      ]);
      written.push({ num: object.num, gen: object.gen, offset });
    }
    const xrefPos = out.length;
    xrefPositions.push(xrefPos);
    const entries = [...written].sort((a, b) => a.num - b.num);
    const rows = xrefPositions.length === 1
      ? [{ num: 0, gen: 65535, offset: 0, free: true as const }, ...entries.map((entry) => ({ ...entry, free: false as const }))]
      : entries.map((entry) => ({ ...entry, free: false as const }));
    let xref = "xref\n";
    let index = 0;
    while (index < rows.length) {
      let end = index;
      while (end + 1 < rows.length && rows[end + 1].num === rows[end].num + 1) end += 1;
      xref += `${rows[index].num} ${end - index + 1}\n`;
      for (let cursor = index; cursor <= end; cursor += 1) {
        xref += xrefEntry(rows[cursor].offset, rows[cursor].gen, rows[cursor].free ? "f" : "n");
      }
      index = end + 1;
    }
    const size = Math.max(...entries.map((entry) => entry.num)) + 1;
    const prev = xrefPositions.length > 1 ? ` /Prev ${xrefPositions[xrefPositions.length - 2]}` : "";
    out = Buffer.concat([
      out,
      Buffer.from(
        `${xref}trailer\n<< /Size ${size} /Root ${section.root}${prev} >>\nstartxref\n${xrefPos}\n%%EOF\n`
      ),
    ]);
  }
  return out;
}

function reusedAnnotationPdf(): Buffer {
  const text = "BT /F1 12 Tf 40 100 Td (KEEP-THIS-SENTENCE) Tj ET";
  return buildPdf([
    {
      root: "1 0 R",
      objects: [
        { num: 1, gen: 0, body: "<< /Type /Catalog /Pages 2 0 R >>" },
        { num: 2, gen: 0, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
        {
          num: 3,
          gen: 0,
          body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> /Annots [6 0 R] >>",
        },
        { num: 4, gen: 0, body: `<< /Length ${text.length} >>\nstream\n${text}\nendstream` },
        { num: 5, gen: 0, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
        {
          num: 6,
          gen: 0,
          body: "<< /Type /Annot /Subtype /Text /Contents (deleted-generation) /Rect [1 1 2 2] >>",
        },
      ],
    },
    {
      root: "1 0 R",
      objects: [
        {
          num: 6,
          gen: 1,
          body: `<< /Type /Annot /Subtype /Text /Contents (${UNRELATED_ANNOTATION}) /Rect [10 10 40 40] /NM (unrelated-reuse) >>`,
        },
      ],
    },
  ]);
}

function updatedCatalogPdf(): Buffer {
  const text = "BT /F1 12 Tf 40 80 Td (CATALOG-UPDATE-TEXT) Tj ET";
  return buildPdf([
    {
      root: "2 0 R",
      objects: [
        { num: 2, gen: 0, body: "<< /Type /Catalog /Pages 3 0 R >>" },
        { num: 3, gen: 0, body: "<< /Type /Pages /Kids [4 0 R] /Count 1 >>" },
        {
          num: 4,
          gen: 0,
          body: "<< /Type /Page /Parent 3 0 R /MediaBox [0 0 300 200] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>",
        },
        { num: 5, gen: 0, body: `<< /Length ${text.length} >>\nstream\n${text}\nendstream` },
        { num: 6, gen: 0, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
      ],
    },
    {
      root: "2 1 R",
      objects: [{ num: 2, gen: 1, body: "<< /Type /Catalog /Pages 3 0 R >>" }],
    },
  ]);
}

async function plainPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  page.drawText("PLAIN-CONTROL-TEXT", { x: 40, y: 100, size: 12 });
  return doc.save();
}

async function expectExport(bytes: Uint8Array, label: string, expectedRoot: string, expectedText: string) {
  const signed = Buffer.from(await buildSignedPdf(bytes, [placement()]));
  const index = checkIndex(signed);
  assert.equal(index.badCount, 0, `${label} index has ${index.badCount} bad entries`);
  assert.ok(index.checked > 0, `${label} index checked nothing`);
  assert.equal(index.root, expectedRoot, `${label} root`);
  const doc = await PDFDocument.load(signed);
  assert.equal(String(doc.context.trailerInfo.Root), expectedRoot, `${label} loaded root`);
  assert.match(await pageText(signed), new RegExp(expectedText), `${label} content`);
  assert.equal(hasTestMark(doc), true, `${label} test mark`);
  assert.equal(doc.getPageCount(), 1, `${label} page count`);
}

async function main() {
  currentStep = "reused-annotation";
  const reused = reusedAnnotationPdf();
  const loadedReuse = await PDFDocument.load(reused);
  assert.deepEqual(pageAnnotRefs(loadedReuse), ["6 0 R"]);
  const signedReuse = Buffer.from(await buildSignedPdf(reused, [placement()]));
  const reuseIndex = checkIndex(signedReuse);
  assert.equal(reuseIndex.badCount, 0);
  const reuseDoc = await PDFDocument.load(signedReuse);
  assert.deepEqual(pageAnnotRefs(reuseDoc), ["6 0 R"]);
  assert.equal(annotationTexts(reuseDoc).includes(UNRELATED_ANNOTATION), false);
  assert.match(await pageText(signedReuse), /KEEP-THIS-SENTENCE/);
  assert.equal(hasTestMark(reuseDoc), true);

  const passed = ["reused-annotation"];
  if (SAMPLE_PATH) {
    currentStep = "sample";
    const sample = readFileSync(SAMPLE_PATH);
    assert.equal(sample.length, 65797);
    const sampleSigned = Buffer.from(await buildSignedPdf(sample, [placement()]));
    const sampleIndex = checkIndex(sampleSigned);
    assert.equal(sampleIndex.badCount, 0);
    assert.equal(sampleIndex.root, "12 1 R");
    const sampleText = await pageText(sampleSigned);
    assert.match(sampleText, /E-sign test document/);
    assert.match(sampleText, /SAMPLE FILE/);
    const sampleDoc = await PDFDocument.load(sampleSigned);
    assert.equal(String(sampleDoc.context.trailerInfo.Root), "12 1 R");
    assert.equal(hasTestMark(sampleDoc), true);
    assert.equal(sampleDoc.getPageCount(), 1);
    passed.push("sample");
  }

  currentStep = "plain-pdf";
  const plain = await plainPdf();
  const plainDoc = await PDFDocument.load(plain);
  const plainRoot = String(plainDoc.context.trailerInfo.Root);
  await expectExport(plain, "plain", plainRoot, "PLAIN-CONTROL-TEXT");

  currentStep = "updated-catalog";
  await expectExport(updatedCatalogPdf(), "catalog", "2 1 R", "CATALOG-UPDATE-TEXT");

  passed.push("plain", "updated-catalog");
  console.log(`PASS esign export generations { ${passed.join(", ")} }`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : "verify_failed";
  console.error("FAIL esign export generations", currentStep);
  console.error(message);
  process.exit(1);
});
