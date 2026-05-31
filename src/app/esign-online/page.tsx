import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import EsignOnlineIllustration from "@/components/marketing/illustrations/EsignOnlineIllustration";

export const metadata: Metadata = {
  title: "E-Sign Documents Online | StudiosisLab",
  description:
    "Upload, prepare, and manage e-sign document workflows online with StudiosisLab’s simple e-sign tool.",
  alternates: {
    canonical: "/esign-online",
  },
};

const esignFaqItems = [
  {
    question: "Do I need an account to use e-sign features?",
    answer: "Account sign-in is used for secure access and workflow continuity.",
  },
  {
    question: "Can I track agreement status?",
    answer: "Yes. The tools flow includes document status visibility for recent agreements.",
  },
  {
    question: "Are documents handled securely?",
    answer: "Document workflows use secure transport and controlled access patterns within the platform.",
  },
  {
    question: "Can I continue an agreement later?",
    answer: "Yes. Recent agreements allow you to reopen and continue active workflows.",
  },
] as const;

const esignFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: esignFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function EsignOnlineLandingPage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(esignFaqSchema) }}
        />
        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            E-Sign Documents Online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Upload documents, prepare signature workflows, and manage agreement progress with a clear,
            practical e-sign process built for everyday business and document tasks.
          </p>
          <div className="mt-6">
            <Link
              href="/tools"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Upload Document
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <EsignOnlineIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <SectionBlock title="Sign PDF online">
            <p>
              For direct PDF signing tasks, use the focused signing workflow page.
            </p>
            <p>
              <Link href="/esign-online/sign-pdf-online" className="font-medium text-zinc-900 underline">
                Visit Sign PDF Online
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Free electronic signature and secure online signing">
            <p>
              Explore how to start electronic signature workflows with current core free access, secure
              online document handling, and account-based workflow visibility.
            </p>
            <p>
              <Link
                href="/esign-online/free-electronic-signature"
                className="font-medium text-zinc-900 underline"
              >
                Visit Free Electronic Signature and Security Workflow Guide
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="E-sign for small business">
            <p>
              See a practical overview designed for lean teams and recurring document operations.
            </p>
            <p>
              <Link
                href="/esign-online/e-sign-for-small-business"
                className="font-medium text-zinc-900 underline"
              >
                Visit E-Sign for Small Business
              </Link>
            </p>
          </SectionBlock>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Benefits">
            <ul className="list-disc space-y-2 pl-5">
              <li>Upload documents and prepare them for signature workflows.</li>
              <li>Add and manage signature steps for practical agreements.</li>
              <li>Track workflow status through a simple document pipeline.</li>
              <li>Useful for small teams, founders, and operational tasks.</li>
              <li>Designed to keep the process straightforward and transparent.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How It Works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Upload your document into the e-sign workspace.</li>
              <li>Prepare signature areas and document details.</li>
              <li>Send, sign, or continue managing the agreement workflow.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Security and Trust">
            <p>
              StudiosisLab uses secure connections and account-based workflows for document actions.
              We continuously improve handling practices to protect user trust in e-sign operations.
            </p>
            <p>
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Read Security information
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="FAQ">
            {esignFaqItems.map((item) => (
              <div key={item.question} className="space-y-1">
                <h3 className="font-medium text-zinc-900">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </SectionBlock>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-6">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">
            Related reading
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 sm:text-base">
            <li>
              <Link
                href="/blog/how-online-e-sign-workflows-save-time-for-small-teams"
                className="font-medium text-zinc-900 underline"
              >
                How Online E-Sign Workflows Save Time for Small Teams
              </Link>
            </li>
            <li>
              <Link
                href="/blog/how-to-build-a-resume-that-passes-ats-in-2026"
                className="font-medium text-zinc-900 underline"
              >
                How to Build a Resume That Passes ATS in 2026
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 text-center shadow-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Start your e-sign workflow</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Upload a document and move from preparation to signature with a focused online flow.
          </p>
          <div className="mt-5">
            <Link
              href="/tools"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Upload Document
            </Link>
          </div>
        </section>
      </article>
    </MarketingPageShell>
  );
}
