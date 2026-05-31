import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import EsignOnlineIllustration from "@/components/marketing/illustrations/EsignOnlineIllustration";

export const metadata: Metadata = {
  title: "Free Electronic Signature | StudiosisLab",
  description:
    "Use StudiosisLab for a free electronic signature workflow with document upload, signature preparation, and secure online access.",
  alternates: {
    canonical: "/esign-online/free-electronic-signature",
  },
};

const faqItems = [
  {
    question: "Is the electronic signature workflow available at no cost?",
    answer:
      "StudiosisLab currently provides free access to core e-sign workflows so users can prepare and complete common document tasks.",
  },
  {
    question: "Can I use a free electronic signature flow for personal paperwork?",
    answer:
      "Yes. The workflow can be used for practical personal and professional PDF signing needs.",
  },
  {
    question: "Will I still have access to my recent agreements?",
    answer:
      "Yes. Recent agreement history in the tools workspace helps you reopen and continue active document flows.",
  },
  {
    question: "Where can I review trust and security details?",
    answer:
      "Visit the Security page for current information about connection security and account-based access controls.",
  },
  {
    question: "How is a secure electronic signature workflow supported on StudiosisLab?",
    answer:
      "Workflows use authenticated account access, controlled document actions, and agreement visibility so users can monitor active signing progress.",
  },
  {
    question: "Can I use this for secure online signing across recurring documents?",
    answer:
      "Yes. You can use the same online signing flow across recurring documents while keeping status and recent agreements visible in your workspace.",
  },
  {
    question: "What should I review for document signing security details?",
    answer:
      "For current details, review the Security page for information on secure transport, access control, and document handling practices.",
  },
] as const;

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Free Electronic Signature",
  description:
    "Use StudiosisLab for a free electronic signature workflow with document upload, signature preparation, and secure online access.",
  url: "https://studiosislab.com/esign-online/free-electronic-signature",
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

export default function FreeElectronicSignaturePage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            Free Electronic Signature
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            If you need a free electronic signature workflow for day-to-day documents, StudiosisLab keeps
            the process clear: upload your PDF, prepare signature steps, and manage progress online.
          </p>
        </section>

        <section className="mt-10">
          <EsignOnlineIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Benefits">
            <ul className="list-disc space-y-2 pl-5">
              <li>Access core e-sign features without added setup complexity.</li>
              <li>Handle agreements in one browser-based workspace.</li>
              <li>Maintain visibility into drafts, pending steps, and completed states.</li>
              <li>Support recurring document tasks without a heavy toolchain.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How it works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Open the tools workspace and upload your PDF file.</li>
              <li>Set up signature-related steps and document details.</li>
              <li>Complete the workflow and return to recent agreements as needed.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6">
          <SectionBlock title="How secure electronic signature workflows are handled">
            <p>
              StudiosisLab uses authenticated user access so document actions are tied to the account
              running the workflow. This helps keep signing access and progress visibility scoped to the
              active workspace.
            </p>
            <p>
              Signing steps follow controlled workflow stages, from upload and preparation to completion,
              with agreement tracking visibility for active and recent documents.
            </p>
            <p>
              The platform is built for secure online document handling through account-based access and
              secure transport. For current trust details, review the{" "}
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Security page
              </Link>
              .
            </p>
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
              <Link
                href="/esign-online/e-sign-for-small-business"
                className="font-medium text-zinc-900 underline"
              >
                E-Sign for Small Business
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
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Security information
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 text-center shadow-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Start your free electronic signature workflow
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Upload a document and complete signature steps in a clean online flow.
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
