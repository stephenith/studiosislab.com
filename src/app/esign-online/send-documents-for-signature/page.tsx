import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import EsignOnlineIllustration from "@/components/marketing/illustrations/EsignOnlineIllustration";

export const metadata: Metadata = {
  title: "Send Documents for Signature Online | StudiosisLab",
  description:
    "Send documents for signature online with StudiosisLab. Prepare PDFs, guide recipients through signing, and manage document signing workflows from one place.",
  alternates: {
    canonical: "/esign-online/send-documents-for-signature",
  },
};

const faqItems = [
  {
    question: "Can I send documents for signature without printing and scanning?",
    answer:
      "Yes. You can upload a PDF, prepare signature steps, and move recipients through the workflow without print-scan loops.",
  },
  {
    question: "Is this useful for teams that collect approvals frequently?",
    answer:
      "Yes. It is useful for recurring approvals, onboarding packets, service agreements, and internal signoff workflows.",
  },
  {
    question: "How can I keep track of signing progress after sending?",
    answer:
      "Workflow visibility helps you monitor draft and active agreements so you can follow up with better timing.",
  },
  {
    question: "Where can I review security details for document handling?",
    answer:
      "For current trust details, review the Security page for information about account-based access and handling practices.",
  },
] as const;

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Send Documents for Signature Online",
  description:
    "Send documents for signature online with StudiosisLab. Prepare PDFs, guide recipients through signing, and manage document signing workflows from one place.",
  url: "https://studiosislab.com/esign-online/send-documents-for-signature",
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

export default function SendDocumentsForSignaturePage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            Send Documents for Signature Online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Send signature-ready documents without printing, scanning, or chasing scattered email threads.
            StudiosisLab helps you prepare PDFs, share signing steps with recipients, and keep progress visible.
          </p>
        </section>

        <section className="mt-10">
          <EsignOnlineIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Benefits">
            <ul className="list-disc space-y-2 pl-5">
              <li>Send documents from one browser workflow instead of fragmented tools.</li>
              <li>Reduce manual follow-ups with clearer signing progress visibility.</li>
              <li>Keep draft and in-progress agreements in one organized workspace.</li>
              <li>Support repeatable signature collection across recurring workflows.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How the workflow works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Upload the PDF that needs signatures.</li>
              <li>Prepare signature steps and document details.</li>
              <li>Share and track agreement progress until completion.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6">
          <SectionBlock title="When this is useful">
            <p>
              This workflow is useful when your team regularly sends agreements for client approvals,
              onboarding documents, vendor paperwork, or internal signoffs. It is especially practical for
              remote teams that need clear handoffs and faster document turnaround.
            </p>
            <p>
              If your process currently depends on attachments and reminder emails, centralizing signature
              steps can reduce delays and version confusion.
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
              <Link href="/esign-online/sign-pdf-online" className="font-medium text-zinc-900 underline">
                Sign PDF Online
              </Link>
            </li>
            <li>
              <Link
                href="/esign-online/free-electronic-signature"
                className="font-medium text-zinc-900 underline"
              >
                Free Electronic Signature
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
            Start sending documents for signature
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Upload your PDF, prepare signature steps, and move agreements forward with less friction.
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
