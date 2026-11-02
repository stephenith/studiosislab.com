import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "About StudiosisLab",
  description:
    "StudiosisLab is a browser workspace for documents. Build a resume, sign a PDF, or make an invoice. No payment is required for the features available today.",
  alternates: {
    canonical: "/about",
  },
};

const linkClass = "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-950";

export default function AboutPage() {
  return (
    <LegalPageShell
      title="About StudiosisLab"
      intro="StudiosisLab is a place to create and manage documents in the browser. The live tools are a resume editor, an e-sign workspace, and an invoice tool."
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
          You can build a resume, sign a PDF, and make an invoice. Resume editing and e-sign use a
          Google account. The invoice stays in this browser and does not need an account. No payment is
          required for these features today. Advertising may appear so the current tools can stay free.
          That is not a promise about future features.
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
            — read how e-sign works, then sign in to upload a PDF.
          </li>
          <li>
            <Link href="/tools/invoice" className={linkClass}>
              Invoice
            </Link>{" "}
            — create an A4 PDF in this browser. No account.
          </li>
          <li>
            <Link href="/tools" className={linkClass}>
              E-sign workspace
            </Link>{" "}
            — sign in with Google to upload a PDF and download the finished file.
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
          The live tools are the resume editor, the e-sign workspace, and the invoice tool. A later
          tool is not part of the product until it is on the site and can be used. There is no date
          for anything that is not listed above.
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
