import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import EsignOnlineIllustration from "@/components/marketing/illustrations/EsignOnlineIllustration";

export const metadata: Metadata = {
  title: "E-Sign for Small Business | StudiosisLab",
  description:
    "Use StudiosisLab e-sign workflows for small business document operations, from PDF preparation to signature completion and tracking.",
  alternates: {
    canonical: "/esign-online/e-sign-for-small-business",
  },
};

const faqItems = [
  {
    question: "How can small teams use e-sign workflows for daily operations?",
    answer:
      "Small teams can use one repeatable flow for contracts, approvals, and client-facing paperwork by keeping document steps in one workspace.",
  },
  {
    question: "Can founders and operations teams track agreement status?",
    answer:
      "Yes. Status visibility is available in the tools workspace so teams can quickly see where each agreement stands.",
  },
  {
    question: "Is this useful when multiple documents are active at once?",
    answer:
      "Yes. Centralized recent agreements help teams reopen active documents and continue work without losing context.",
  },
  {
    question: "Where can our team review security details before rollout?",
    answer:
      "Your team can review StudiosisLab security details on the Security page for current practices and guidance.",
  },
] as const;

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "E-Sign for Small Business",
  description:
    "Use StudiosisLab e-sign workflows for small business document operations, from PDF preparation to signature completion and tracking.",
  url: "https://studiosislab.com/esign-online/e-sign-for-small-business",
  isPartOf: {
    "@type": "WebSite",
    name: "StudiosisLab",
    url: "https://studiosislab.com",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function EsignForSmallBusinessPage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            E-Sign for Small Business
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Small businesses need document workflows that are practical and easy to maintain. StudiosisLab
            helps teams move from upload to signature completion with clearer day-to-day coordination.
          </p>
        </section>

        <section className="mt-10">
          <EsignOnlineIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Benefits">
            <ul className="list-disc space-y-2 pl-5">
              <li>Keep contracts and approvals in one organized online flow.</li>
              <li>Reduce manual follow-up work for common document handoffs.</li>
              <li>Give operations teams better visibility into agreement progress.</li>
              <li>Support repeatable workflows across client and internal documents.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How it works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Upload a business document that needs signatures.</li>
              <li>Prepare signature details and workflow steps.</li>
              <li>Track completion status and reopen agreements when needed.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6">
          <SectionBlock title="FAQ">
            {faqItems.map((item) => (
              <div key={item.question} className="space-y-1">
                <h3 className="font-medium text-zinc-900">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </SectionBlock>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-6">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">Related reading</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 sm:text-base">
            <li>
              <Link href="/esign-online" className="font-medium text-zinc-900 underline">
                E-Sign Documents Online hub
              </Link>
            </li>
            <li>
              <Link href="/esign-online/sign-pdf-online" className="font-medium text-zinc-900 underline">
                Sign PDF Online
              </Link>
            </li>
            <li>
              <Link
                href="/blog/how-online-esign-workflows-save-time-for-small-teams"
                className="font-medium text-zinc-900 underline"
              >
                How Online E-Sign Workflows Save Time for Small Teams
              </Link>
            </li>
            <li>
              <Link
                href="/blog/improving-document-turnaround-time-with-digital-signing"
                className="font-medium text-zinc-900 underline"
              >
                How Digital Signing Can Improve Document Turnaround Time
              </Link>
            </li>
            <li>
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Security information
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 text-center shadow-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Run your small-business e-sign workflow
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Start with a PDF upload and manage agreements through a focused online process.
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
