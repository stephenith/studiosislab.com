import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import EsignOnlineIllustration from "@/components/marketing/illustrations/EsignOnlineIllustration";

export const metadata: Metadata = {
  title: "Sign PDF Online | StudiosisLab",
  description:
    "Sign PDF files online with a simple workflow for upload, signature prep, and document completion in StudiosisLab.",
  alternates: {
    canonical: "/esign-online/sign-pdf-online",
  },
};

const faqItems = [
  {
    question: "Can I sign a PDF from my browser without installing software?",
    answer:
      "Yes. You can upload a PDF and complete signature steps directly in the browser workflow.",
  },
  {
    question: "Do I need to create an account before signing a PDF?",
    answer:
      "Account sign-in helps keep document actions tied to your workspace so you can reopen and continue later.",
  },
  {
    question: "Can I return to a draft PDF after closing the page?",
    answer:
      "Yes. Draft agreements can be reopened from your tools workspace when they are still active.",
  },
  {
    question: "Where can I review document handling practices?",
    answer:
      "You can review StudiosisLab security details on the Security page for current handling and access practices.",
  },
] as const;

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sign PDF Online",
  description:
    "Sign PDF files online with a simple workflow for upload, signature prep, and document completion in StudiosisLab.",
  url: "https://studiosislab.com/esign-online/sign-pdf-online",
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

export default function SignPdfOnlinePage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            Sign PDF Online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Need to sign a PDF quickly? StudiosisLab gives you a focused browser workflow to upload a file,
            place signatures, and keep document progress organized in one place.
          </p>
        </section>

        <section className="mt-10">
          <EsignOnlineIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Benefits">
            <ul className="list-disc space-y-2 pl-5">
              <li>Sign PDF files without switching between multiple apps.</li>
              <li>Keep active agreements visible in a single workflow view.</li>
              <li>Reduce delays caused by manual back-and-forth handoffs.</li>
              <li>Continue drafts later when a document needs updates.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How it works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Upload your PDF to start a signing flow.</li>
              <li>Prepare fields and signature steps for the document.</li>
              <li>Complete signing and track progress from the tools workspace.</li>
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
              <Link
                href="/esign-online"
                className="font-medium text-zinc-900 underline"
              >
                E-Sign Documents Online hub
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
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Start signing your PDF</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Upload your file and move from draft to signed document with a practical online flow.
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
