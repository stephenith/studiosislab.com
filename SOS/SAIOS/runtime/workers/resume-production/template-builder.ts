/**
 * Fabric JSON template builder — consumes Production Design Bundle.
 * Applies Design Plan, Design System tokens, and role-specific content.
 */
import { randomUUID } from "node:crypto";
import type { DesignPlan } from "./types-v2.js";
import type { ProductionDesignBundle } from "./design-bundle.js";
import { buildProductionDesignBundle } from "./design-bundle.js";
import type { PremiumIntegrationContext } from "./types-v3.js";

type FabricObj = Record<string, unknown>;

export type BuildTemplateOptions = {
  familyId: string;
  objective?: string;
  designPlan?: DesignPlan;
  designBundle?: ProductionDesignBundle;
  integration?: PremiumIntegrationContext;
};

export type TemplateSpec = {
  margin_left: number;
  margin_right: number;
  content_w: number;
  accent: string;
  name_pt: number;
  title_pt: number;
  contact_pt: number;
  section_pt: number;
  body_pt: number;
  body_line_height: number;
  name_line_height: number;
  section_char_spacing: number;
  section_gap_px: number;
  heading_body_gap_px: number;
  paragraph_gap_px: number;
  bullet_line_px: number;
  plain_line_px: number;
  header_top_px: number;
  header_to_content_px: number;
  header_name_below_accent_gap_px: number;
  header_name_to_title_gap_px: number;
  header_title_to_contact_gap_px: number;
  header_contact_to_summary_gap_px: number;
  section_order: string[];
  name_weight: number;
  title_weight: number;
  section_weight: number;
  job_title_pt: number;
  date_pt: number;
  experience_entry_gap_px: number;
  role_to_date_gap_px: number;
  date_to_bullet_gap_px: number;
  accent_bar_height_px: number;
  accent_bar_width_px: number;
  header_rule_width_px: number;
  header_rule_thickness_px: number;
  header_rule_gap_below_contact_px: number;
  contact_letter_spacing: number;
  section_transitions: Record<string, number>;
  section_marker_width_px: number;
  section_marker_height_px: number;
  section_rule_thickness_px: number;
  section_rule_gap_below_heading_px: number;
  section_rule_gap_above_content_px: number;
  bullet_gap_px: number;
  title_letter_spacing: number;
  role_company_split: boolean;
  company_pt: number;
  company_weight: number;
  role_to_company_gap_px: number;
  company_to_date_gap_px: number;
  experience_marker_width_px: number;
  bullet_metric_weight: number;
  experience_role_weight: number;
};

type RoleContent = {
  name: string;
  title: string;
  contact: string;
  summary: string[];
  experience: string[];
  skills: string[];
  education: string[];
  certifications: string[];
};

function uid(): string {
  return randomUUID();
}

function resolveSpec(options: BuildTemplateOptions): TemplateSpec & {
  primary_font: string;
  color_text: string;
  color_muted: string;
  color_subtle: string;
  color_divider: string;
  canvas_width: number;
  canvas_height: number;
} {
  const bundle =
    options.designBundle ??
    (options.integration ? buildProductionDesignBundle(options.integration) : null);

  if (!bundle) {
    throw new Error("Design Bundle required — production must consume Design System");
  }

  return bundle.resolved;
}

function resolveRoleContent(objective?: string): RoleContent {
  const lower = (objective ?? "").toLowerCase();
  if (lower.includes("software engineer")) {
    return {
      name: "Alex Chen",
      title: "Senior Software Engineer",
      contact:
        "alex.chen@email.com  |  (555) 010-4821  |  San Francisco, CA  |  github.com/alexchen",
      summary: [
        "Senior software engineer with 9+ years building scalable distributed systems and cloud-native products.",
        "Strong track record shipping reliable services with measurable latency, availability, and developer-experience improvements.",
      ],
      experience: [
        "Senior Software Engineer — Northstar Platform",
        "01/2021 – Present",
        "• Led migration of monolith to 14 microservices on Kubernetes; reduced deploy time 68% and improved p99 latency 41%.",
        "• Designed event-driven ingestion pipeline processing 2.4M events/day with 99.97% delivery reliability.",
        "• Mentored 5 engineers; established code review standards and on-call playbooks.",
        "",
        "Software Engineer — Brightline Systems",
        "06/2017 – 12/2020",
        "• Built React + TypeScript admin console used by 40K monthly active internal users.",
        "• Implemented CI/CD with automated test gates; cut production incidents 35% year over year.",
        "• Optimized PostgreSQL queries and caching layer; improved report generation from 12s to 2.1s.",
      ],
      skills: [
        "TypeScript, Python, Go, React, Node.js, PostgreSQL, Redis, AWS, Kubernetes, Docker, GraphQL, REST APIs, System Design, CI/CD",
      ],
      education: [
        "B.S. Computer Science — Pacific State University",
        "2013 – 2017  |  GPA: 3.8  |  Dean's List",
      ],
      certifications: [
        "AWS Certified Solutions Architect — Associate (2023)",
      ],
    };
  }

  return {
    name: "Jordan Lee",
    title: "Operations & Strategy Professional",
    contact:
      "jordan.lee@email.com  |  (555) 010-2847  |  Austin, TX  |  linkedin.com/in/jordan-lee",
    summary: [
      "Results-driven operations leader with 8+ years optimizing cross-functional programs,",
      "vendor partnerships, and KPI-driven workflows. Proven record of reducing cycle time 30%",
      "while scaling teams across SaaS and professional services environments.",
    ],
    experience: [
      "Senior Operations Manager — Northbridge Analytics",
      "03/2021 – Present",
      "• Led a 12-person operations team supporting $18M ARR; improved SLA adherence from 82% to 96%.",
      "• Redesigned intake workflow, cutting average project kickoff time from 14 days to 9 days.",
      "• Partnered with Finance and Product to implement quarterly capacity planning and forecasting.",
      "",
      "Operations Analyst — Summit Health Group",
      "06/2017 – 02/2021",
      "• Built reporting dashboards tracking 25+ operational metrics for executive stakeholders.",
      "• Managed vendor RFP process saving $240K annually while maintaining service quality.",
      "• Standardized SOP documentation across 4 regional sites with 99% audit compliance.",
    ],
    skills: [
      "Operations Strategy, Process Improvement, KPI Management, Cross-Functional Leadership,",
      "Vendor Management, SQL, Excel, Tableau, Asana, Salesforce, Stakeholder Communication",
    ],
    education: [
      "B.S. Business Administration — Riverside State University",
      "2013 – 2017  |  GPA: 3.7  |  Dean's List",
    ],
    certifications: [
      "Certified Scrum Product Owner (CSPO) — 2022",
      "Lean Six Sigma Green Belt — 2020",
    ],
  };
}

function baseProps(left: number, top: number): FabricObj {
  return {
    version: "6.9.1",
    originX: "left",
    originY: "top",
    left,
    top,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    visible: true,
    fillRule: "nonzero",
    paintFirst: "fill",
    globalCompositeOperation: "source-over",
    skewX: 0,
    skewY: 0,
  };
}

function pageBackground(spec: TemplateSpec & { canvas_width: number; canvas_height: number; color_divider: string }): FabricObj {
  const id = uid();
  return {
    ...baseProps(0, 0),
    rx: 0,
    ry: 0,
    type: "Rect",
    width: spec.canvas_width,
    height: spec.canvas_height,
    fill: "#ffffff",
    stroke: spec.color_divider,
    strokeWidth: 1,
    strokeDashArray: null,
    strokeLineCap: "butt",
    strokeDashOffset: 0,
    strokeLineJoin: "miter",
    strokeUniform: false,
    strokeMiterLimit: 4,
    shadow: null,
    backgroundColor: "",
    role: "pageBackground",
    name: "Page Background",
    isPageBg: true,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    id,
    data: { role: "pageBackground", kind: "page-bg", system: true, id },
  };
}

function textbox(
  text: string,
  left: number,
  top: number,
  spec: TemplateSpec & { primary_font: string; color_text: string },
  opts: {
    width?: number;
    fontSize?: number;
    fontWeight?: number | string;
    fill?: string;
    lineHeight?: number;
    charSpacing?: number;
    textAlign?: string;
    fontFamily?: string;
    height?: number;
  } = {},
): FabricObj {
  const id = uid();
  const fontSize = opts.fontSize ?? spec.body_pt;
  const lineHeight = opts.lineHeight ?? spec.body_line_height;
  const width = opts.width ?? spec.content_w;
  const metrics = verticalTextMetrics(text, fontSize, lineHeight, width);
  const height = opts.height ?? metrics.height;
  return {
    ...baseProps(left, top),
    type: "Textbox",
    text,
    width: opts.width ?? spec.content_w,
    height,
    fontSize: opts.fontSize ?? spec.body_pt,
    fontWeight: opts.fontWeight ?? "normal",
    fontFamily: opts.fontFamily ?? spec.primary_font,
    fontStyle: "normal",
    lineHeight: opts.lineHeight ?? spec.body_line_height,
    charSpacing: opts.charSpacing ?? 0,
    textAlign: opts.textAlign ?? "left",
    fill: opts.fill ?? spec.color_text,
    underline: false,
    overline: false,
    linethrough: false,
    styles: [],
    pathStartOffset: 0,
    pathSide: "left",
    pathAlign: "baseline",
    textBackgroundColor: "",
    direction: "ltr",
    textDecorationThickness: 66.667,
    minWidth: 20,
    splitByGrapheme: false,
    stroke: null,
    strokeWidth: 1,
    shadow: null,
    backgroundColor: "",
    id,
    data: { id },
  };
}

function hline(
  left: number,
  top: number,
  width: number,
  stroke: string,
  strokeWidth = 1,
): FabricObj {
  const id = uid();
  return {
    ...baseProps(left, top),
    type: "Line",
    x1: 0,
    y1: 0,
    x2: width,
    y2: 0,
    stroke,
    strokeWidth,
    strokeDashArray: null,
    fill: "rgb(0,0,0)",
    shadow: null,
    selectable: false,
    evented: false,
    excludeFromExport: false,
    id,
    data: { id, decorative: true, role: "section-rule" },
  };
}

function accentMarker(
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
): FabricObj {
  const id = uid();
  return {
    ...baseProps(left, top),
    type: "Rect",
    width,
    height,
    fill: color,
    stroke: null,
    strokeWidth: 0,
    rx: 0,
    ry: 0,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    shadow: null,
    id,
    data: { id, decorative: true, role: "section-marker" },
  };
}

function textboxBottom(box: FabricObj): number {
  return Number(box.top ?? 0) + Number(box.height ?? 0);
}

function buildHeaderBlock(
  content: RoleContent,
  spec: TemplateSpec & {
    primary_font: string;
    color_text: string;
    color_muted: string;
    color_subtle: string;
    color_divider: string;
    canvas_width: number;
    canvas_height: number;
    accent_bar_height_px: number;
    accent_bar_width_px: number;
    header_rule_width_px: number;
    header_rule_thickness_px: number;
    header_rule_gap_below_contact_px: number;
    contact_letter_spacing: number;
    header_name_below_accent_gap_px: number;
    header_name_to_title_gap_px: number;
    header_title_to_contact_gap_px: number;
    header_contact_to_summary_gap_px: number;
  },
  ml: number,
  ht: number,
  accent: string,
  content_w: number,
): { objects: FabricObj[]; summaryStartY: number } {
  const objects: FabricObj[] = [];
  objects.push(accentBar(ml, ht, spec.accent_bar_width_px, spec.accent_bar_height_px, accent));

  let headerY = ht + spec.header_name_below_accent_gap_px;
  const nameBox = textbox(content.name, ml, headerY, spec, {
    fontSize: spec.name_pt,
    fontWeight: spec.name_weight,
    fill: spec.color_text,
    width: content_w,
    lineHeight: spec.name_line_height,
  });
  objects.push(nameBox);

  headerY = textboxBottom(nameBox) + spec.header_name_to_title_gap_px;
  const titleBox = textbox(content.title, ml, headerY, spec, {
    fontSize: spec.title_pt,
    fontWeight: spec.title_weight,
    fill: spec.color_muted,
    width: content_w,
    lineHeight: 1.25,
    charSpacing: spec.title_letter_spacing,
  });
  objects.push(titleBox);

  headerY = textboxBottom(titleBox) + spec.header_title_to_contact_gap_px;
  const contactBox = textbox(content.contact, ml, headerY, spec, {
    fontSize: spec.contact_pt,
    fontWeight: 400,
    fill: spec.color_subtle,
    width: content_w,
    lineHeight: 1.3,
    charSpacing: spec.contact_letter_spacing,
  });
  objects.push(contactBox);

  const contactBottom = textboxBottom(contactBox);
  const ruleY = contactBottom + spec.header_rule_gap_below_contact_px;
  objects.push(
    hline(ml, ruleY, spec.header_rule_width_px, accent, spec.header_rule_thickness_px),
  );

  const summaryStartY =
    ruleY + spec.header_rule_thickness_px + (spec.header_contact_to_summary_gap_px - spec.header_rule_gap_below_contact_px);
  return { objects, summaryStartY };
}

function accentBar(
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
): FabricObj {
  const id = uid();
  return {
    ...baseProps(left, top),
    type: "Rect",
    width,
    height,
    fill: color,
    stroke: null,
    strokeWidth: 0,
    rx: 0,
    ry: 0,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    shadow: null,
    id,
    data: { id, role: "accent-bar" },
  };
}

const SECTION_LABELS: Record<string, string> = {
  summary: "PROFESSIONAL SUMMARY",
  experience: "WORK EXPERIENCE",
  skills: "TECHNICAL SKILLS",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
};

function verticalTextMetrics(
  text: string,
  fontSize: number,
  lineHeight: number,
  width: number,
): { lines: number; height: number; advance: number } {
  const charsPerLine = Math.max(20, Math.floor(width / (fontSize * 0.48)));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const height = Math.ceil(lines * fontSize * lineHeight) + 6;
  return { lines, height, advance: height + 10 };
}

function classifyExperienceLine(line: string): "empty" | "role" | "date" | "bullet" | "other" {
  if (line === "") return "empty";
  if (line.startsWith("•")) return "bullet";
  if (/^\d{2}\/\d{4}/.test(line) || /–\s*(Present|\d{2}\/\d{4})/.test(line)) return "date";
  if (line.includes(" — ")) return "role";
  return "other";
}

function parseRoleLine(line: string): { role: string; company: string } {
  const parts = line.split(" — ");
  return { role: parts[0]?.trim() ?? line, company: parts[1]?.trim() ?? "" };
}

function hasMetricEmphasis(text: string): boolean {
  return /(\d+%|\d+\.\d+|\d+[KMB]|\$\d|p99|99\.\d+%)/i.test(text);
}

function appendSectionHeadingDecorations(
  objects: FabricObj[],
  spec: TemplateSpec & { color_divider: string; accent: string },
  ml: number,
  headingBottom: number,
  markerWidth?: number,
): number {
  const markerY = headingBottom + spec.section_rule_gap_below_heading_px;
  objects.push(
    accentMarker(
      ml,
      markerY,
      markerWidth ?? spec.section_marker_width_px,
      spec.section_marker_height_px,
      spec.accent,
    ),
  );
  const ruleY = markerY + spec.section_marker_height_px + 4;
  objects.push(
    hline(ml, ruleY, spec.content_w, spec.color_divider, spec.section_rule_thickness_px),
  );
  return ruleY + spec.section_rule_thickness_px + spec.section_rule_gap_above_content_px;
}

function experienceSectionBlock(
  sectionKey: string,
  heading: string,
  top: number,
  bodyLines: string[],
  spec: TemplateSpec & {
    primary_font: string;
    color_text: string;
    color_muted: string;
    color_subtle: string;
    color_divider: string;
    accent: string;
  },
): { objects: FabricObj[]; nextY: number } {
  const objects: FabricObj[] = [];
  const ml = spec.margin_left;
  objects.push(
    textbox(heading, ml, top, spec, {
      fontSize: spec.section_pt,
      fontWeight: spec.section_weight,
      fill: spec.color_text,
      charSpacing: spec.section_char_spacing,
      width: spec.content_w,
      lineHeight: 1.2,
    }),
  );
  const headingAdvance = verticalTextMetrics(
    heading,
    spec.section_pt,
    1.2,
    spec.content_w,
  ).advance;
  const headingBottom = top + headingAdvance;
  let bodyY = appendSectionHeadingDecorations(
    objects,
    spec,
    ml,
    headingBottom,
    spec.experience_marker_width_px,
  );

  for (const line of bodyLines) {
    const kind = classifyExperienceLine(line);
    if (kind === "empty") {
      bodyY += spec.experience_entry_gap_px;
      continue;
    }
    if (kind === "role") {
      if (spec.role_company_split) {
        const { role, company } = parseRoleLine(line);
        const roleBox = textbox(role, ml, bodyY, spec, {
          fontSize: spec.job_title_pt,
          fontWeight: spec.experience_role_weight,
          fill: spec.color_text,
          width: spec.content_w,
          lineHeight: 1.3,
        });
        objects.push(roleBox);
        bodyY = textboxBottom(roleBox) + spec.role_to_company_gap_px;
        if (company) {
          const companyBox = textbox(company, ml, bodyY, spec, {
            fontSize: spec.company_pt,
            fontWeight: spec.company_weight,
            fill: spec.color_muted,
            width: spec.content_w,
            lineHeight: 1.25,
          });
          objects.push(companyBox);
          bodyY = textboxBottom(companyBox) + spec.company_to_date_gap_px;
        }
      } else {
        const roleBox = textbox(line, ml, bodyY, spec, {
          fontSize: spec.job_title_pt,
          fontWeight: spec.experience_role_weight,
          fill: spec.color_text,
          width: spec.content_w,
          lineHeight: 1.3,
        });
        objects.push(roleBox);
        bodyY = textboxBottom(roleBox) + spec.role_to_date_gap_px;
      }
      continue;
    }
    if (kind === "date") {
      const dateBox = textbox(line, ml, bodyY, spec, {
        fontSize: spec.date_pt,
        fontWeight: 400,
        fill: spec.color_subtle,
        width: spec.content_w,
        lineHeight: 1.25,
      });
      objects.push(dateBox);
      bodyY = textboxBottom(dateBox) + spec.date_to_bullet_gap_px;
      continue;
    }
    const bulletBox = textbox(line, ml, bodyY, spec, {
      fontSize: spec.body_pt,
      fontWeight: hasMetricEmphasis(line) ? spec.bullet_metric_weight : 400,
      fill: spec.color_text,
      width: spec.content_w,
      lineHeight: spec.body_line_height,
    });
    objects.push(bulletBox);
    bodyY = textboxBottom(bulletBox) + spec.bullet_gap_px;
  }

  const transitionGap = spec.section_transitions[sectionKey] ?? spec.section_gap_px;
  return { objects, nextY: bodyY + transitionGap };
}

function sectionBlock(
  sectionKey: string,
  heading: string,
  top: number,
  bodyLines: string[],
  spec: TemplateSpec & {
    primary_font: string;
    color_text: string;
    color_divider: string;
    accent: string;
  },
): { objects: FabricObj[]; nextY: number } {
  const objects: FabricObj[] = [];
  const ml = spec.margin_left;
  objects.push(
    textbox(heading, ml, top, spec, {
      fontSize: spec.section_pt,
      fontWeight: spec.section_weight,
      fill: spec.color_text,
      charSpacing: spec.section_char_spacing,
      width: spec.content_w,
      lineHeight: 1.2,
    }),
  );
  const headingAdvance = verticalTextMetrics(heading, spec.section_pt, spec.body_line_height, spec.content_w).advance;
  const headingBottom = top + headingAdvance;
  let bodyY = appendSectionHeadingDecorations(objects, spec, ml, headingBottom);
  for (const line of bodyLines) {
    if (line === "") {
      bodyY += spec.paragraph_gap_px + 4;
      continue;
    }
    objects.push(
      textbox(line, ml, bodyY, spec, {
        fontSize: spec.body_pt,
        fontWeight: "normal",
        fill: spec.color_text,
        width: spec.content_w,
        lineHeight: spec.body_line_height,
      }),
    );
    bodyY += verticalTextMetrics(line, spec.body_pt, spec.body_line_height, spec.content_w).advance;
  }
  const transitionGap = spec.section_transitions[sectionKey] ?? spec.section_gap_px;
  return { objects, nextY: bodyY + transitionGap };
}

export type BuiltTemplate = {
  prototype_id: string;
  title: string;
  family_id: string;
  tier: "ats_safe";
  json: { version: string; width: number; height: number; objects: FabricObj[] };
  metrics: { content_bottom_px: number; page_utilization: number };
};

export function buildModernAtsProfessionalTemplate(
  familyIdOrOptions: string | BuildTemplateOptions,
): BuiltTemplate {
  const options: BuildTemplateOptions =
    typeof familyIdOrOptions === "string"
      ? { familyId: familyIdOrOptions }
      : familyIdOrOptions;

  const spec = resolveSpec(options);
  const content = resolveRoleContent(options.objective);
  const objects: FabricObj[] = [];
  objects.push(pageBackground(spec));

  const ht = spec.header_top_px;
  const ml = spec.margin_left;
  const header = buildHeaderBlock(content, spec, ml, ht, spec.accent, spec.content_w);
  objects.push(...header.objects);

  let y = header.summaryStartY;
  const sections: Record<string, string[]> = {
    summary: content.summary,
    experience: content.experience,
    skills: content.skills,
    education: content.education,
    certifications: content.certifications,
  };

  for (const key of spec.section_order) {
    const lines = sections[key];
    const label = SECTION_LABELS[key];
    if (!lines?.length || !label) continue;
    const block =
      key === "experience"
        ? experienceSectionBlock(key, label, y, lines, spec)
        : sectionBlock(key, label, y, lines, spec);
    objects.push(...block.objects);
    y = block.nextY;
  }

  const textboxes = objects.filter((o) => o.type === "Textbox");
  const contentBottom = textboxes.reduce((max, o) => {
    const top = Number(o.top ?? 0);
    const height = Number(o.height ?? 20);
    return Math.max(max, top + height);
  }, 0);

  const utilization = Math.round((contentBottom / spec.canvas_height) * 1000) / 1000;
  const roleSlug = (options.objective ?? "").toLowerCase().includes("software engineer")
    ? "software-engineer"
    : "professional";

  return {
    prototype_id: `modern-ats-professional-v1-cal-${roleSlug}`,
    title: "Modern ATS Professional Resume (Calibrated)",
    family_id: options.familyId,
    tier: "ats_safe",
    json: {
      version: "6.9.1",
      width: spec.canvas_width,
      height: spec.canvas_height,
      objects,
    },
    metrics: {
      content_bottom_px: Math.round(contentBottom),
      page_utilization: utilization,
    },
  };
}
