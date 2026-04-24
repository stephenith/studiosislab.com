import t001 from "@/data/template-json/t001.json";
import t002 from "@/data/template-json/t002.json";
import t003 from "@/data/template-json/t003.json";

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
    tags: ["modern", "clean"],
    thumbnail: "/templates/t001.png",
    load: () => Promise.resolve(t001),
  },
  {
    id: "t002",
    name: "Creative Designer",
    tags: ["creative", "portfolio"],
    thumbnail: "/templates/t002.png",
    load: () => Promise.resolve(t002),
  },
  {
    id: "t003",
    name: "Professional Manager",
    tags: ["corporate", "leadership"],
    thumbnail: "/templates/t003.png",
    load: () => Promise.resolve(t003),
  },
];

export const SYSTEM_TEMPLATE_IDS = SYSTEM_TEMPLATES.map((template) => template.id);

export const getSystemTemplateById = (id: string) => {
  const normalized = (id || "").toLowerCase().trim();
  return SYSTEM_TEMPLATES.find((template) => template.id === normalized);
};
