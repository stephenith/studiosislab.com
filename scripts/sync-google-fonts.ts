import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GoogleWebfontsResponse = {
  items?: GoogleFontItem[];
};

type GoogleFontItem = {
  family: string;
  category?: string;
  variants?: string[];
  files?: Record<string, string>;
};

type FontStyle = "normal" | "italic";

type FontVariant = {
  id: string;
  label: string;
  weight: number;
  style: FontStyle;
  fileUrl: string;
};

type FontFamily = {
  family: string;
  category?: string;
  variants: FontVariant[];
};

const OUTPUT_FILE = path.join(process.cwd(), "src/data/fonts/catalog.json");
const OUTPUT_LIMIT = 300;
const stats = {
  totalFonts: 0,
  keptFonts: 0,
  skippedFontsNoVariants: 0,
  skippedVariantParse: 0,
  skippedVariantMissingFile: 0,
};

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

function parseVariant(token: string): { weight: number; style: FontStyle } | null {
  if (!token) return null;
  if (token === "regular") return { weight: 400, style: "normal" };
  if (token === "italic") return { weight: 400, style: "italic" };

  const style: FontStyle = token.endsWith("italic") ? "italic" : "normal";
  const numericPart = token.replace("italic", "");
  const weight = Number(numericPart);
  if (!Number.isFinite(weight)) return null;
  if (weight < 100 || weight > 900) return null;
  return { weight, style };
}

function variantLabel(weight: number, style: FontStyle) {
  const base = WEIGHT_LABELS[weight] || String(weight);
  return style === "italic" ? `${base} Italic` : base;
}

function resolveFileUrl(token: string, files: Record<string, string>) {
  if (files[token]) return files[token];
  if (token === "regular") return files["regular"] || files["400"];
  if (token === "italic") return files["italic"] || files["400italic"];
  return undefined;
}

function toCatalogItem(item: GoogleFontItem): FontFamily | null {
  const variants = item.variants || [];
  const files = item.files || {};
  const dedup = new Set<string>();
  const mapped: FontVariant[] = [];

  for (const token of variants) {
    const parsed = parseVariant(token);
    if (!parsed) {
      stats.skippedVariantParse += 1;
      continue;
    }

    const fileUrl = resolveFileUrl(token, files);
    if (!fileUrl) {
      stats.skippedVariantMissingFile += 1;
      continue;
    }

    const id = `${parsed.weight}-${parsed.style}`;
    if (dedup.has(id)) continue;
    dedup.add(id);

    mapped.push({
      id,
      label: variantLabel(parsed.weight, parsed.style),
      weight: parsed.weight,
      style: parsed.style,
      fileUrl,
    });
  }

  if (!item.family || mapped.length === 0) {
    stats.skippedFontsNoVariants += 1;
    return null;
  }

  mapped.sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
  stats.keptFonts += 1;

  return {
    family: item.family,
    category: item.category,
    variants: mapped,
  };
}

async function readPreviousCatalog() {
  try {
    const raw = await readFile(OUTPUT_FILE, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_FONTS_API_KEY environment variable.");
  }

  const previousCatalog = await readPreviousCatalog();

  const url =
    "https://www.googleapis.com/webfonts/v1/webfonts" +
    `?key=${encodeURIComponent(apiKey)}` +
    "&sort=popularity" +
    "&capability=WOFF2";

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Failed to call Google Fonts API: ${String(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Google Fonts API failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as GoogleWebfontsResponse;
  const items = payload.items || [];
  stats.totalFonts = items.length;

  const allFamilies = items
    .map((item) => toCatalogItem(item))
    .filter((item): item is FontFamily => item !== null);

  const families = allFamilies.slice(0, OUTPUT_LIMIT);

  if (families.length === 0) {
    throw new Error("No usable fonts were produced from API response.");
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  // Keep current frontend contract (array) to avoid runtime breakage.
  await writeFile(OUTPUT_FILE, `${JSON.stringify(families, null, 2)}\n`, "utf8");

  console.log("[fonts] total from API:", items.length);
  console.log("[fonts] kept before limit:", allFamilies.length);
  console.log("[fonts] kept after limit:", families.length);
  console.log("[fonts] skipped fonts (no variants):", stats.skippedFontsNoVariants);
  console.log("[fonts] skipped variant parse:", stats.skippedVariantParse);
  console.log("[fonts] skipped variant missing file:", stats.skippedVariantMissingFile);

  console.log(
    `[sync:fonts] Wrote ${families.length} families to ${OUTPUT_FILE} at ${new Date().toISOString()}`
  );
  if (previousCatalog == null) {
    console.log("[sync:fonts] No previous catalog detected.");
  }
}

main().catch((error) => {
  console.error("[sync:fonts] Failed. Existing catalog file was not modified.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
