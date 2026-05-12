import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Help Center | StudiosisLab",
  description:
    "Find support and guidance for StudiosisLab resume tools, e-sign documents, account access, privacy, and downloads.",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpCenterPage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-3xl pt-2 text-zinc-900 sm:pt-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Help Center</h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600">
          Find quick guidance for using StudiosisLab tools, managing documents, and understanding
          account, privacy, and support options.
        </p>

        <div className="mt-8 space-y-6">
          <SectionBlock title="Account & Login">
            <p>
              Sign in with Google to access account-linked workflows and saved progress. If you are
              returning to previous work, use the same account you originally used on StudiosisLab.
            </p>
            <p>
              <Link href="/login" className="font-medium text-zinc-900 underline">
                Go to Login
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Resume Builder">
            <p>
              Choose a template, edit content directly in the builder, and export resumes for job
              applications. You can start from a template or continue from recent work.
            </p>
            <p>
              <Link href="/resume-builder" className="font-medium text-zinc-900 underline">
                Resume Builder Overview
              </Link>{" "}
              ·{" "}
              <Link href="/resume" className="font-medium text-zinc-900 underline">
                Open Resume Tool
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="E-Sign Documents">
            <p>
              Upload documents, prepare agreements, insert signatures, and continue workflows from your
              recent agreements list. Verification flows are available for completed documents.
            </p>
            <p>
              <Link href="/esign-online" className="font-medium text-zinc-900 underline">
                E-Sign Overview
              </Link>{" "}
              ·{" "}
              <Link href="/tools" className="font-medium text-zinc-900 underline">
                Open E-Sign Tool
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Privacy & Security">
            <p>
              StudiosisLab uses secure connections and account-based access patterns for sensitive
              workflows. For policy details, review privacy and security pages.
            </p>
            <p>
              <Link href="/privacy-policy" className="font-medium text-zinc-900 underline">
                Privacy Policy
              </Link>{" "}
              ·{" "}
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Security
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Downloads & Exports">
            <p>
              StudiosisLab supports practical output workflows for resumes and e-sign documents. Export
              options are continually improved to support quality and compatibility.
            </p>
          </SectionBlock>

          <SectionBlock title="Guides & Tutorials">
            <p>
              Read practical guides on resume writing, document workflows, and e-sign best practices in
              the StudiosisLab blog.
            </p>
            <p>
              <Link href="/blog" className="font-medium text-zinc-900 underline">
                Visit the StudiosisLab Blog
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Contact Support">
            <p>
              If you need help with account access, files, or workflow issues, contact our support
              team.
            </p>
            <p>
              <Link href="/contact" className="font-medium text-zinc-900 underline">
                Contact StudiosisLab
              </Link>
            </p>
          </SectionBlock>
        </div>
      </article>
    </MarketingPageShell>
  );
}
