/**
 * Component mapping — section → construction component.
 */
import type { ComponentMapping, SectionOrdering } from "./types.js";

const SECTION_TO_COMPONENT: Record<
  string,
  { component: string; role: string; children?: string[] }
> = {
  header: {
    component: "HeaderBlock",
    role: "identity",
    children: ["NameText", "ContactLine", "AccentRule"],
  },
  summary: {
    component: "SummaryBlock",
    role: "summary",
    children: ["SectionHeading", "BodyParagraph"],
  },
  experience: {
    component: "ExperienceBlock",
    role: "experience",
    children: ["SectionHeading", "RoleHeader", "BulletList"],
  },
  skills: {
    component: "SkillsBlock",
    role: "skills",
    children: ["SectionHeading", "SkillsLine"],
  },
  education: {
    component: "EducationBlock",
    role: "education",
    children: ["SectionHeading", "EducationRow"],
  },
  certifications: {
    component: "CertificationsBlock",
    role: "certifications",
    children: ["SectionHeading", "BulletList"],
  },
  projects: {
    component: "ProjectsBlock",
    role: "projects",
    children: ["SectionHeading", "RoleHeader", "BulletList"],
  },
  languages: {
    component: "LanguagesBlock",
    role: "languages",
    children: ["SectionHeading", "SkillsLine"],
  },
};

export function mapComponents(sections: SectionOrdering): ComponentMapping[] {
  return sections.order.map((section) => {
    const meta = SECTION_TO_COMPONENT[section] ?? {
      component: "GenericSectionBlock",
      role: section,
      children: ["SectionHeading", "BodyParagraph"],
    };
    return {
      section,
      component: meta.component,
      role: meta.role,
      required: sections.required.includes(section),
      children: meta.children,
    };
  });
}
