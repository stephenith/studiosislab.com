import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "About StudiosisLab",
  description:
    "StudiosisLab is a free online tools platform for resumes, e-signing, and document workflows—with guides, optional ads that help keep core tools free, and clear policies.",
  alternates: {
    canonical: "/about",
  },
};

const linkClass = "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-950";

export default function AboutPage() {
  return (
    <LegalPageShell
      title="About StudiosisLab"
      intro="StudiosisLab is a free online tools platform. We focus on practical resume and document workflows, e-signing, and helpful guides—built to stay simple, fast, and accessible in the browser."
    >
      <SectionBlock title="Who operates StudiosisLab?">
        <p>
          StudiosisLab is built and operated by Studiosis as an independent, small-team platform. We
          focus on free and accessible online tools for creative and document work, and we improve the
          product iteratively based on real usage and feedback.
        </p>
      </SectionBlock>

      <SectionBlock title="What is StudiosisLab?">
        <p>
          StudiosisLab brings together resume building, PDF-oriented document tasks, and e-signing in
          one place. You can explore features without a heavy install: everything runs as a modern web
          app. Where it makes sense, the site may be supported by advertising so we can keep core
          tools free to use. We are not trying to be the loudest product on the market—we want
          dependable workflows that feel approachable for everyday use.
        </p>
      </SectionBlock>

      <SectionBlock title="What You Can Use Today">
        <p>
          These areas are live today and will evolve as we ship improvements:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link href="/resume-builder" className={linkClass}>
              Resume Builder
            </Link>{" "}
            — start from templates and messaging geared toward clear, professional resumes.
          </li>
          <li>
            <Link href="/resume" className={linkClass}>
              Resume hub
            </Link>{" "}
            — open the resume experience and continue work on drafts and downloads.
          </li>
          <li>
            <Link href="/esign-online" className={linkClass}>
              E-sign online
            </Link>{" "}
            — overview of how we approach digital signing and document preparation.
          </li>
          <li>
            <Link href="/tools" className={linkClass}>
              E-sign tools
            </Link>{" "}
            — document utilities and signing-related workflows in one entry point.
          </li>
          <li>
            <Link href="/blog" className={linkClass}>
              Blog
            </Link>{" "}
            — practical guides on resumes, documents, and productivity.
          </li>
        </ul>
      </SectionBlock>

      <SectionBlock title="Who We Build For">
        <p>
          We design StudiosisLab for students and job seekers polishing first resumes, professionals
          updating materials for new roles, freelancers juggling client paperwork, and small teams
          that need straightforward document and signing steps. The interface stays intentionally
          light so you can focus on the file or agreement in front of you—not on learning a complex
          product map.
        </p>
      </SectionBlock>

      <SectionBlock title="How We Are Building">
        <p>
          We ship in iterations: resume and document flows first, e-sign paths where they matter most,
          and blog content that answers real questions we see in support and usage. Over time we plan
          to add more document and creative tools on the same principles—simple entry points, honest
          labeling, and no inflated promises. We are not announcing fixed dates; when something is
          ready, you will see it on the site and in the changelog of releases users care about.
        </p>
      </SectionBlock>

      <SectionBlock title="Trust, Privacy, and Security">
        <p>
          Transparency matters for a product that handles files and sign-ins. Our policies describe
          what we collect, how authentication works, and how we think about security:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link href="/privacy-policy" className={linkClass}>
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/terms-and-conditions" className={linkClass}>
              Terms &amp; Conditions
            </Link>
          </li>
          <li>
            <Link href="/security" className={linkClass}>
              Security
            </Link>
          </li>
        </ul>
        <p>
          If something in the product or a policy page is unclear, we would rather hear about it than
          leave you guessing—use the contact options below.
        </p>
      </SectionBlock>

      <SectionBlock title="Contact and Feedback">
        <p>
          Questions, bug reports, and product feedback help us prioritize the right work. Reach us
          through{" "}
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>{" "}
          so your message goes to the right inbox. We read what you send even if we cannot reply to
          every note immediately.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
