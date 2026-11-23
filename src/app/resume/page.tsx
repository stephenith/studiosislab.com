import type { Metadata } from "next";
import ResumeHubClient, { type ResumeRolePageLink } from "./ResumeHubClient";
import { getAllPublishedTemplateSeoPages } from "@/lib/templateSeo";

export const metadata: Metadata = {
  title: "Resume Templates & Builder | StudiosisLab",
  description:
    "Browse resume templates and start creating professional resumes online with StudiosisLab.",
  alternates: {
    canonical: "/resume",
  },
};

export default function ResumePage() {
  const rolePages: ResumeRolePageLink[] = getAllPublishedTemplateSeoPages().map((page) => ({
    templateId: page.templateId,
    href: `/resume/${page.slug}`,
    label: page.h1.replace(/^&#x20;/, "").trim(),
  }));

  return <ResumeHubClient rolePages={rolePages} />;
}
