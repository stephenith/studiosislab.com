/**
 * Agent #236 — Role-specific fictional sample packs for BlockRenderer.
 * Placeholder only — never personal user data.
 */
export type RoleSample = {
  name: string;
  title: string;
  contact: string;
  summary: string;
  roles: Array<{
    title: string;
    company: string;
    dates: string;
    bullets: string[];
  }>;
  skills: string;
  education: string[];
  certifications?: string[];
  projects?: Array<{ title: string; detail: string }>;
  languages?: string;
};

const PACKS: Record<string, RoleSample[]> = {
  marketing_manager: [
    {
      name: "Alex Morgan",
      title: "Marketing Manager",
      contact:
        "alex.morgan@example.com  ·  +1 (555) 010-2040  ·  Austin, TX  ·  linkedin.com/in/alexmorgan",
      summary:
        "Marketing Manager with 8+ years leading integrated brand, demand generation, and go-to-market programs for B2B SaaS. Translates strategy into measurable pipeline and enablement systems sales teams use.",
      roles: [
        {
          title: "Marketing Manager",
          company: "Northstar Analytics",
          dates: "2021 — Present",
          bullets: [
            "Owned multi-channel campaigns that grew qualified pipeline 34% YoY while reducing cost-per-opportunity 18%.",
            "Built messaging frameworks adopted by a 40-person sales org; shortened ramp time by 3 weeks.",
            "Launched two category narratives with Product and CS used across webinars and ABM plays.",
            "Implemented attribution reporting aligning Marketing and RevOps on forecast inputs.",
          ],
        },
        {
          title: "Senior Marketing Specialist",
          company: "Brightline CRM",
          dates: "2018 — 2021",
          bullets: [
            "Led product launch campaigns for three releases; generated 2,400+ MQLs in two quarters.",
            "Redesigned nurture sequences that lifted email-influenced opportunities 22%.",
            "Managed agency partners while keeping brand voice consistent across channels.",
            "Built competitive battle cards used in 80% of enterprise opportunities.",
          ],
        },
        {
          title: "Marketing Coordinator",
          company: "Fieldwork Media",
          dates: "2016 — 2018",
          bullets: [
            "Coordinated webinar series averaging 320 attendees; sourced 90+ SQLs annually.",
            "Maintained campaign calendars and asset QA across paid and organic channels.",
            "Supported brand refresh rollout across website and sales collateral.",
          ],
        },
      ],
      skills:
        "Demand Generation  ·  Brand Strategy  ·  ABM  ·  SEO / Content  ·  Marketing Analytics  ·  Sales Enablement",
      education: [
        "B.A. Marketing — University of Texas at Austin  ·  2014",
        "Certificate, Digital Marketing Strategy — General Assembly  ·  2017",
      ],
      certifications: [
        "Google Analytics IQ",
        "HubSpot Inbound Marketing Certification",
        "Meta Blueprint — Media Buying Fundamentals",
      ],
      projects: [
        {
          title: "Always-On ABM Pilot",
          detail: "40-account pilot with tailored creative; booked 19 meetings in 90 days.",
        },
      ],
      languages: "English (Native)  ·  Spanish (Professional)",
    },
  ],
  software_engineer: [
    {
      name: "Jordan Blake",
      title: "Software Engineer",
      contact:
        "jordan.blake@example.com  ·  +1 (555) 014-2201  ·  Seattle, WA  ·  github.com/jordanblake",
      summary:
        "Software Engineer with 7+ years building reliable backend services and developer platforms. Focused on API design, observability, and pragmatic delivery in cloud-native environments.",
      roles: [
        {
          title: "Software Engineer",
          company: "Cascade Systems",
          dates: "2021 — Present",
          bullets: [
            "Designed and shipped event-driven services handling 12M events/day with 99.95% availability.",
            "Reduced p95 API latency 38% via query tuning, caching, and connection pool redesign.",
            "Led migration of legacy auth to OIDC; cut security review findings by half.",
            "Mentored three engineers through design reviews and on-call readiness.",
          ],
        },
        {
          title: "Software Engineer",
          company: "Harbor Labs",
          dates: "2018 — 2021",
          bullets: [
            "Built CI pipelines that cut average deploy time from 42 to 11 minutes.",
            "Implemented typed client SDKs adopted by four internal product teams.",
            "Owned incident retrospectives that reduced repeat Sev-2s by 27%.",
            "Introduced contract tests that prevented three production regressions in one quarter.",
          ],
        },
        {
          title: "Junior Software Engineer",
          company: "Orbit Pay",
          dates: "2016 — 2018",
          bullets: [
            "Shipped payment reconciliation jobs processing 1.2M daily ledger rows.",
            "Improved test coverage from 41% to 78% on the billing service.",
            "Documented runbooks that cut onboarding time for new engineers by two weeks.",
          ],
        },
      ],
      skills:
        "TypeScript  ·  Node.js  ·  Python  ·  PostgreSQL  ·  AWS  ·  Kubernetes  ·  System Design  ·  Observability",
      education: ["B.S. Computer Science — University of Washington  ·  2017"],
      certifications: [
        "AWS Certified Developer – Associate",
        "Kubernetes Application Developer (CKAD)",
      ],
      projects: [
        {
          title: "Internal Feature Flag Platform",
          detail: "Built flag service with audit trails used by 18 services in production.",
        },
        {
          title: "Open-source CLI Toolkit",
          detail: "Maintainer of a developer CLI with 2.1k GitHub stars.",
        },
      ],
      languages: "English (Native)  ·  Mandarin (Conversational)",
    },
  ],
  graphic_designer: [
    {
      name: "Riley Soto",
      title: "Graphic Designer",
      contact:
        "riley.soto@example.com  ·  +1 (555) 019-7740  ·  Brooklyn, NY  ·  riley.soto.example/portfolio",
      summary:
        "Graphic Designer specializing in brand systems, editorial layouts, and campaign visuals for digital-first products. Combines craft with practical production for marketing and product teams.",
      roles: [
        {
          title: "Graphic Designer",
          company: "Studio North",
          dates: "2020 — Present",
          bullets: [
            "Led visual system refresh for a SaaS brand across web, social, and sales decks.",
            "Designed 40+ campaign assets/quarter with consistent type hierarchy and grid discipline.",
            "Partnered with Product on empty-state illustration set that lifted activation 9%.",
            "Established Figma component library adopted by three freelancers and two agencies.",
          ],
        },
        {
          title: "Junior Designer",
          company: "Brightform",
          dates: "2017 — 2020",
          bullets: [
            "Produced packaging and digital campaigns for six consumer launches.",
            "Improved presentation templates that reduced design revision cycles 30%.",
            "Created social templates that kept brand consistency across 12 weekly posts.",
            "Supported photo art direction for two seasonal lookbooks.",
          ],
        },
        {
          title: "Design Intern",
          company: "Paper & Pixel",
          dates: "2016 — 2017",
          bullets: [
            "Assisted senior designers on identity explorations for three startups.",
            "Prepared print-ready files and production checklists for local print partners.",
            "Built mood boards and type studies for pitch decks.",
          ],
        },
      ],
      skills:
        "Brand Systems  ·  Typography  ·  Layout  ·  Figma  ·  Adobe CC  ·  Motion Basics  ·  Design Ops",
      education: ["B.F.A. Graphic Design — Pratt Institute  ·  2016"],
      projects: [
        {
          title: "Editorial Series — Signal",
          detail: "Art directed a 12-issue digital magazine with modular cover system.",
        },
        {
          title: "Product Illustration Kit",
          detail: "Created 28-illustration kit for onboarding and help center.",
        },
      ],
      certifications: ["Google UX Design Certificate"],
      languages: "English (Native)  ·  Portuguese (Fluent)",
    },
  ],
  accountant: [
    {
      name: "Morgan Ellis",
      title: "Accountant",
      contact:
        "morgan.ellis@example.com  ·  +1 (555) 016-3099  ·  Chicago, IL",
      summary:
        "Accountant with 8+ years in financial reporting, month-end close, and audit support for mid-market companies. Known for accurate books, clear schedules, and calm cross-functional communication.",
      roles: [
        {
          title: "Accountant",
          company: "Lakeview Industrials",
          dates: "2020 — Present",
          bullets: [
            "Owned month-end close for a $90M revenue entity; reduced close cycle from 9 to 6 days.",
            "Prepared GAAP financials and supporting schedules used in annual external audit.",
            "Implemented expense policy controls that cut coding errors 22%.",
            "Partnered with FP&A on variance analysis for quarterly board packages.",
          ],
        },
        {
          title: "Staff Accountant",
          company: "Peregrine Advisory",
          dates: "2016 — 2020",
          bullets: [
            "Managed AP/AR reconciliation and bank statements for 14 client entities.",
            "Supported SOX-lite control documentation for two PE-backed portfolio companies.",
            "Automated recurring journal entries in NetSuite, saving ~6 hours weekly.",
            "Prepared 1099 packages and year-end client deliverables on schedule.",
          ],
        },
        {
          title: "Accounting Associate",
          company: "Northbridge CPA",
          dates: "2015 — 2016",
          bullets: [
            "Assisted audits with PBC lists, tie-outs, and workpaper organization.",
            "Reconciled credit card and prepaid accounts for mid-market clients.",
            "Drafted client emails clarifying documentation requests during busy season.",
          ],
        },
      ],
      skills:
        "Financial Reporting  ·  Month-End Close  ·  GAAP  ·  Audit Support  ·  NetSuite  ·  Excel / Sheets  ·  Internal Controls",
      education: [
        "B.S. Accounting — University of Illinois Chicago  ·  2015",
      ],
      certifications: [
        "CPA (Illinois)",
        "QuickBooks Online Certified ProAdvisor",
        "Excel Expert — MOS",
      ],
      projects: [
        {
          title: "Close Calendar Redesign",
          detail: "Rebuilt close calendar and owners map; cut late tasks by 40% in two cycles.",
        },
      ],
      languages: "English (Native)",
    },
  ],
  hr_manager: [
    {
      name: "Casey Rivera",
      title: "HR Manager",
      contact:
        "casey.rivera@example.com  ·  +1 (555) 018-4412  ·  Denver, CO  ·  linkedin.com/in/caseyrivera",
      summary:
        "HR Manager with 9+ years leading people operations, talent programs, and employee relations for growing tech teams. Builds practical HR systems that managers trust and employees understand.",
      roles: [
        {
          title: "HR Manager",
          company: "Summit Cloud",
          dates: "2021 — Present",
          bullets: [
            "Scaled people programs from 120 to 280 employees while keeping eNPS above 48.",
            "Redesigned performance cycle with clearer rubrics; manager completion rose to 97%.",
            "Led ER cases with documented processes that reduced time-to-resolution 35%.",
            "Partnered with Finance on headcount planning and compensation bands.",
          ],
        },
        {
          title: "HR Generalist",
          company: "Fieldnote",
          dates: "2017 — 2021",
          bullets: [
            "Owned full-cycle recruiting for GTM roles; filled 40+ positions with <45 day average.",
            "Implemented onboarding checklist that improved 30-day retention by 8 points.",
            "Administered benefits renewals and open enrollment for a multi-state workforce.",
            "Drafted policy updates for remote work and leave that managers could apply consistently.",
          ],
        },
        {
          title: "HR Coordinator",
          company: "Atlas Retail Group",
          dates: "2015 — 2017",
          bullets: [
            "Coordinated interview logistics for 25+ weekly candidates across three locations.",
            "Maintained employee files and I-9 compliance with zero audit findings.",
            "Supported engagement survey follow-ups that improved manager action completion.",
          ],
        },
      ],
      skills:
        "People Operations  ·  Employee Relations  ·  Talent Acquisition  ·  Performance  ·  Compensation  ·  HRIS (BambooHR)  ·  Policy Design",
      education: [
        "B.A. Psychology — University of Colorado Boulder  ·  2014",
        "SHRM coursework — People Management Certificate  ·  2019",
      ],
      certifications: ["SHRM-CP", "HRCI PHR"],
      languages: "English (Native)  ·  Spanish (Professional)",
    },
  ],
};

export class RoleContentUnavailableError extends Error {
  readonly code = "ROLE_CONTENT_UNAVAILABLE" as const;
  readonly roleFamily: string;
  constructor(roleFamily: string) {
    super(
      `ROLE_CONTENT_UNAVAILABLE: no deterministic sample pack for role_family="${roleFamily}" (refusing unrelated profession fallback)`,
    );
    this.name = "RoleContentUnavailableError";
    this.roleFamily = roleFamily;
  }
}

/** Explicit pack aliases only (SEO / HR naming). No engineer↔designer collapses. */
const PACK_ALIASES: Record<string, keyof typeof PACKS> = {
  human_resources_manager: "hr_manager",
  human_resource_manager: "hr_manager",
};

export function listDeterministicPackFamilies(): string[] {
  return Object.keys(PACKS);
}

/**
 * Resolve a deterministic pack key without unrelated-profession fallback.
 * Missing packs → NONE (caller must fail closed).
 */
export function resolveDeterministicPackFamily(
  roleFamily: string | undefined,
): {
  pack: keyof typeof PACKS | null;
  match: "EXACT" | "ALIAS" | "NONE";
  requested: string;
} {
  const requested = String(roleFamily ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_|_$/g, "");
  if (!requested) {
    return { pack: null, match: "NONE", requested: "" };
  }
  if (PACKS[requested]) {
    return { pack: requested as keyof typeof PACKS, match: "EXACT", requested };
  }
  const alias = PACK_ALIASES[requested];
  if (alias && PACKS[alias]) {
    return { pack: alias, match: "ALIAS", requested };
  }
  return { pack: null, match: "NONE", requested };
}

export function pickRoleSample(
  roleFamily: string | undefined,
  variant = 0,
): RoleSample {
  const resolved = resolveDeterministicPackFamily(roleFamily);
  if (!resolved.pack) {
    throw new RoleContentUnavailableError(
      resolved.requested || String(roleFamily ?? ""),
    );
  }
  const packs = PACKS[resolved.pack]!;
  return packs[Math.abs(variant) % packs.length]!;
}

/** Accept OpenAI (or other) fictional RoleSample payloads when structurally valid. */
export function normalizeRoleSample(raw: unknown): RoleSample | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  const title = String(o.title ?? "").trim();
  const summary = String(o.summary ?? "").trim();
  if (!name || !title || !summary) return null;

  let contact = "";
  if (typeof o.contact === "string") {
    contact = o.contact.trim();
  } else if (o.contact && typeof o.contact === "object" && !Array.isArray(o.contact)) {
    const c = o.contact as Record<string, unknown>;
    contact = [c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio]
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean)
      .join("  ·  ");
  } else if (Array.isArray(o.contact)) {
    contact = o.contact.map((x) => String(x).trim()).filter(Boolean).join("  ·  ");
  }
  if (!contact || /\[object Object\]/i.test(contact)) {
    contact = `${name.toLowerCase().replace(/\s+/g, ".")}@example.com  ·  +1 (555) 010-0000`;
  }

  let skills = "";
  if (typeof o.skills === "string") {
    skills = o.skills
      .replace(/\s*\.\s*(?=[A-Z])/g, "  ·  ")
      .replace(/\s*[|,;/]\s*/g, "  ·  ")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else if (Array.isArray(o.skills)) {
    skills = o.skills.map((s) => String(s).trim()).filter(Boolean).join("  ·  ");
  }
  if (!skills) skills = "Role-specific skills";

  const rolesRaw = Array.isArray(o.roles) ? o.roles : [];
  const educationRaw = Array.isArray(o.education) ? o.education : [];
  if (rolesRaw.length < 2) return null;

  const roles = rolesRaw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const role = r as Record<string, unknown>;
      const bullets = Array.isArray(role.bullets)
        ? role.bullets.map((b) => String(b).trim()).filter(Boolean)
        : [];
      const rt = String(role.title ?? "").trim();
      const company = String(role.company ?? "").trim();
      const dates = String(role.dates ?? "").trim();
      if (!rt || !company || bullets.length === 0) return null;
      return { title: rt, company, dates: dates || "—", bullets };
    })
    .filter(Boolean) as RoleSample["roles"];

  if (roles.length < 2) return null;

  const education = educationRaw.map((e) => String(e).trim()).filter(Boolean);
  const certifications = Array.isArray(o.certifications)
    ? o.certifications.map((c) => String(c).trim()).filter(Boolean)
    : undefined;
  const projects = Array.isArray(o.projects)
    ? o.projects
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const pr = p as Record<string, unknown>;
          const pt = String(pr.title ?? "").trim();
          const detail = String(pr.detail ?? "").trim();
          if (!pt || !detail) return null;
          if (/sample initiative/i.test(pt)) return null;
          return { title: pt, detail };
        })
        .filter(Boolean) as RoleSample["projects"]
    : undefined;
  const languages =
    o.languages != null
      ? Array.isArray(o.languages)
        ? o.languages.map((x) => String(x).trim()).filter(Boolean).join("  ·  ")
        : String(o.languages).trim() || undefined
      : undefined;

  return {
    name,
    title,
    contact,
    summary,
    roles,
    skills,
    education:
      education.length > 0
        ? education
        : ["B.A. — Example University  ·  2016"],
    certifications,
    projects,
    languages,
  };
}

export type ResolveRoleSampleResult =
  | {
      ok: true;
      sample: RoleSample;
      source: "openai" | "deterministic_pack";
      pack_family: string | null;
    }
  | {
      ok: false;
      code: "ROLE_CONTENT_UNAVAILABLE";
      error: string;
      role_family: string;
    };

export function resolveRoleSample(opts: {
  roleFamily?: string;
  variant?: number;
  openaiContent?: unknown;
}): ResolveRoleSampleResult {
  const normalized = normalizeRoleSample(opts.openaiContent);
  if (normalized) {
    return {
      ok: true,
      sample: normalized,
      source: "openai",
      pack_family: null,
    };
  }
  try {
    const resolved = resolveDeterministicPackFamily(opts.roleFamily);
    const sample = pickRoleSample(opts.roleFamily, opts.variant ?? 0);
    return {
      ok: true,
      sample,
      source: "deterministic_pack",
      pack_family: resolved.pack,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: "ROLE_CONTENT_UNAVAILABLE",
      error: msg,
      role_family: String(opts.roleFamily ?? ""),
    };
  }
}
