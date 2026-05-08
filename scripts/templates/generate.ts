import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type TemplateStatus = "draft" | "published";

type ManifestTemplate = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: TemplateStatus;
  tags?: string[];
};

type Manifest = {
  templates: ManifestTemplate[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const MANIFEST_PATH = path.join(ROOT, "templates.manifest.json");
const REGISTRY_OUT_PATH = path.join(
  ROOT,
  "src/data/systemTemplates/registry.generated.ts"
);
const TEMPLATES_OUT_PATH = path.join(ROOT, "src/data/templates.generated.ts");

function ensurePosix(input: string): string {
  return input.split(path.sep).join("/");
}

function assertTemplate(template: ManifestTemplate, index: number) {
  const required: (keyof ManifestTemplate)[] = [
    "id",
    "title",
    "categoryId",
    "thumbnailPath",
    "jsonPath",
    "status",
  ];
  for (const key of required) {
    if (!template[key] || String(template[key]).trim().length === 0) {
      throw new Error(`templates[${index}].${key} is required`);
    }
  }
}

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw) as Manifest;
  if (!Array.isArray(parsed.templates)) {
    throw new Error("templates.manifest.json must contain a templates[] array");
  }
  parsed.templates.forEach(assertTemplate);
  return parsed;
}

function toRegistryImportPath(jsonPathFromRoot: string): string {
  const jsonAbs = path.resolve(ROOT, jsonPathFromRoot);
  const registryDir = path.dirname(REGISTRY_OUT_PATH);
  const rel = ensurePosix(path.relative(registryDir, jsonAbs));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function toTemplatesImportPath(jsonPathFromRoot: string): string {
  const jsonAbs = path.resolve(ROOT, jsonPathFromRoot);
  const templatesDir = path.dirname(TEMPLATES_OUT_PATH);
  const rel = ensurePosix(path.relative(templatesDir, jsonAbs));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function writeGeneratedRegistry(manifest: Manifest) {
  const rows = manifest.templates
    .map((template) => {
      const importPath = toRegistryImportPath(template.jsonPath);
      const tags = JSON.stringify(template.tags ?? []);
      return `  {
    id: ${JSON.stringify(template.id)},
    name: ${JSON.stringify(template.title)},
    tags: ${tags},
    thumbnail: ${JSON.stringify(template.thumbnailPath)},
    load: async () => (await import(${JSON.stringify(importPath)})).default,
  },`;
    })
    .join("\n");

  const content = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by scripts/templates/generate.ts */

export type SystemTemplate = {
  id: string;
  name: string;
  tags: string[];
  thumbnail: string;
  load: () => Promise<unknown>;
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
${rows}
];

export const SYSTEM_TEMPLATE_IDS = SYSTEM_TEMPLATES.map((template) => template.id);

export const getSystemTemplateById = (id: string) => {
  const normalized = (id || "").toLowerCase().trim();
  return SYSTEM_TEMPLATES.find((template) => template.id === normalized);
};
`;

  fs.mkdirSync(path.dirname(REGISTRY_OUT_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_OUT_PATH, content, "utf8");
}

function writeGeneratedTemplates(manifest: Manifest) {
  const imports = manifest.templates
    .map((template, index) => {
      const importPath = toTemplatesImportPath(template.jsonPath);
      return `import tpl${index} from ${JSON.stringify(importPath)};`;
    })
    .join("\n");

  const galleryRows = manifest.templates
    .map((template) => {
      const tags = JSON.stringify(template.tags ?? []);
      return `  {
    id: ${JSON.stringify(template.id)},
    title: ${JSON.stringify(template.title)},
    categoryId: ${JSON.stringify(template.categoryId)},
    category: ${JSON.stringify(template.categoryId)},
    tags: ${tags},
    thumb: ${JSON.stringify(template.thumbnailPath)},
    status: ${JSON.stringify(template.status)},
  },`;
    })
    .join("\n");

  const snapshotRows = manifest.templates
    .map((template, index) => {
      return `  ${JSON.stringify(template.id)}:
    (tpl${index} as any)?.objects && (tpl${index} as any).objects.length > 0
      ? (tpl${index} as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),`;
    })
    .join("\n");

  const content = `/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by scripts/templates/generate.ts */
${imports}

export type Template = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  tags: string[];
  thumb: string;
  status: "draft" | "published";
};

export type TemplateSnapshot = {
  objects: any[];
};

export const TEMPLATES: Template[] = [
${galleryRows}
];

export const TEMPLATE_SNAPSHOTS: Record<string, TemplateSnapshot> = {
  blank: { objects: [] },
${snapshotRows}
};
`;

  fs.mkdirSync(path.dirname(TEMPLATES_OUT_PATH), { recursive: true });
  fs.writeFileSync(TEMPLATES_OUT_PATH, content, "utf8");
}

function main() {
  const manifest = readManifest();
  writeGeneratedRegistry(manifest);
  writeGeneratedTemplates(manifest);
  console.log(
    `[templates] generated ${manifest.templates.length} templates from templates.manifest.json`
  );
}

main();
