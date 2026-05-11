/* AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. */
/* Generated from templates.manifest.json by scripts/templates/generate.ts */
import tpl0 from "./template-json/t001.json";
import tpl1 from "./template-json/t002.json";
import tpl2 from "./template-json/t003.json";
import tpl3 from "./template-json/t004.json";
import tpl4 from "./template-json/t005.json";
import tpl5 from "./template-json/t006.json";
import tpl6 from "./template-json/t007.json";
import tpl7 from "./template-json/t008.json";
import tpl8 from "./template-json/t009.json";
import tpl9 from "./template-json/t010.json";
import tpl10 from "./template-json/t011.json";
import tpl11 from "./template-json/t012.json";
import tpl12 from "./template-json/t013.json";

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
  {
    id: "t001",
    title: "Modern Minimal",
    categoryId: "business",
    category: "business",
    tags: [],
    thumb: "/templates/t001.png",
    status: "published",
  },
  {
    id: "t002",
    title: "Creative Designer",
    categoryId: "creative",
    category: "creative",
    tags: [],
    thumb: "/templates/t002.png",
    status: "published",
  },
  {
    id: "t003",
    title: "Professional Manager",
    categoryId: "business",
    category: "business",
    tags: [],
    thumb: "/templates/t003.png",
    status: "published",
  },
  {
    id: "t004",
    title: "Marketing Manager Resume",
    categoryId: "business",
    category: "business",
    tags: [],
    thumb: "/templates/t004.png",
    status: "published",
  },
  {
    id: "t005",
    title: "Project Manager Resume",
    categoryId: "business",
    category: "business",
    tags: ["business","manager","resume"],
    thumb: "/templates/t005.png",
    status: "published",
  },
  {
    id: "t006",
    title: "Operations Manager Resume",
    categoryId: "business",
    category: "business",
    tags: ["business","operations","resume"],
    thumb: "/templates/t006.png",
    status: "published",
  },
  {
    id: "t007",
    title: "Product Manager Resume",
    categoryId: "business",
    category: "business",
    tags: ["business","product","manager","resume"],
    thumb: "/templates/t007.png",
    status: "published",
  },
  {
    id: "t008",
    title: "Operations Manager Resume (With Image)",
    categoryId: "business",
    category: "business",
    tags: ["business","operations","resume","image"],
    thumb: "/templates/t008.png",
    status: "published",
  },
  {
    id: "t009",
    title: "Executive Resume",
    categoryId: "business",
    category: "business",
    tags: ["business","executive","resume"],
    thumb: "/templates/t009.png",
    status: "published",
  },
  {
    id: "t010",
    title: "Software Engineer Resume",
    categoryId: "it",
    category: "it",
    tags: [],
    thumb: "/templates/t010.png",
    status: "published",
  },
  {
    id: "t011",
    title: "Data Analyst Resume",
    categoryId: "it",
    category: "it",
    tags: [],
    thumb: "/templates/t011.png",
    status: "published",
  },
  {
    id: "t012",
    title: "Front-end Developer Resume",
    categoryId: "it",
    category: "it",
    tags: [],
    thumb: "/templates/t012.png",
    status: "published",
  },
  {
    id: "t013",
    title: "Cyber Security Resume",
    categoryId: "it",
    category: "it",
    tags: [],
    thumb: "/templates/t013.png",
    status: "published",
  },
];

export const TEMPLATE_SNAPSHOTS: Record<string, TemplateSnapshot> = {
  blank: { objects: [] },
  "t001":
    (tpl0 as any)?.objects && (tpl0 as any).objects.length > 0
      ? (tpl0 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t002":
    (tpl1 as any)?.objects && (tpl1 as any).objects.length > 0
      ? (tpl1 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t003":
    (tpl2 as any)?.objects && (tpl2 as any).objects.length > 0
      ? (tpl2 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t004":
    (tpl3 as any)?.objects && (tpl3 as any).objects.length > 0
      ? (tpl3 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t005":
    (tpl4 as any)?.objects && (tpl4 as any).objects.length > 0
      ? (tpl4 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t006":
    (tpl5 as any)?.objects && (tpl5 as any).objects.length > 0
      ? (tpl5 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t007":
    (tpl6 as any)?.objects && (tpl6 as any).objects.length > 0
      ? (tpl6 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t008":
    (tpl7 as any)?.objects && (tpl7 as any).objects.length > 0
      ? (tpl7 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t009":
    (tpl8 as any)?.objects && (tpl8 as any).objects.length > 0
      ? (tpl8 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t010":
    (tpl9 as any)?.objects && (tpl9 as any).objects.length > 0
      ? (tpl9 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t011":
    (tpl10 as any)?.objects && (tpl10 as any).objects.length > 0
      ? (tpl10 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t012":
    (tpl11 as any)?.objects && (tpl11 as any).objects.length > 0
      ? (tpl11 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
  "t013":
    (tpl12 as any)?.objects && (tpl12 as any).objects.length > 0
      ? (tpl12 as TemplateSnapshot)
      : ({ objects: [] } as TemplateSnapshot),
};
