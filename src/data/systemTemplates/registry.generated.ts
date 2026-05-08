/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by scripts/templates/generate.ts */

export type SystemTemplate = {
  id: string;
  name: string;
  tags: string[];
  thumbnail: string;
  load: () => Promise<unknown>;
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: "t001",
    name: "Modern Minimal",
    tags: [],
    thumbnail: "/templates/t001.png",
    load: async () => (await import("../template-json/t001.json")).default,
  },
  {
    id: "t002",
    name: "Creative Designer",
    tags: [],
    thumbnail: "/templates/t002.png",
    load: async () => (await import("../template-json/t002.json")).default,
  },
  {
    id: "t003",
    name: "Professional Manager",
    tags: [],
    thumbnail: "/templates/t003.png",
    load: async () => (await import("../template-json/t003.json")).default,
  },
  {
    id: "t004",
    name: "Marketing Manager Resume",
    tags: [],
    thumbnail: "/templates/t004.png",
    load: async () => (await import("../template-json/t004.json")).default,
  },
  {
    id: "t005",
    name: "Project Manager Resume",
    tags: ["business","manager","resume"],
    thumbnail: "/templates/t005.png",
    load: async () => (await import("../template-json/t005.json")).default,
  },
  {
    id: "t006",
    name: "Operations Manager Resume",
    tags: ["business","operations","resume"],
    thumbnail: "/templates/t006.png",
    load: async () => (await import("../template-json/t006.json")).default,
  },
  {
    id: "t007",
    name: "Product Manager Resume",
    tags: ["business","product","manager","resume"],
    thumbnail: "/templates/t007.png",
    load: async () => (await import("../template-json/t007.json")).default,
  },
  {
    id: "t008",
    name: "Operations Manager Resume (With Image)",
    tags: ["business","operations","resume","image"],
    thumbnail: "/templates/t008.png",
    load: async () => (await import("../template-json/t008.json")).default,
  },
  {
    id: "t009",
    name: "Executive Resume",
    tags: ["business","executive","resume"],
    thumbnail: "/templates/t009.png",
    load: async () => (await import("../template-json/t009.json")).default,
  },
];

export const SYSTEM_TEMPLATE_IDS = SYSTEM_TEMPLATES.map((template) => template.id);

export const getSystemTemplateById = (id: string) => {
  const normalized = (id || "").toLowerCase().trim();
  return SYSTEM_TEMPLATES.find((template) => template.id === normalized);
};
