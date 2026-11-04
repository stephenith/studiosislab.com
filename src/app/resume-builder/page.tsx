import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import ResumeBuilderIllustration from "@/components/marketing/illustrations/ResumeBuilderIllustration";

export const metadata: Metadata = {
  title: "Free Online Resume Builder | StudiosisLab",
  description:
    "Build a resume in the browser from a Resume Template or a blank page. Sign in with Google to save it. Download a PDF, or a PNG on a larger screen. No payment is required today.",
  alternates: {
    canonical: "/resume-builder",
  },
};

const resumeFaqItems = [
  {
    question: "Is StudiosisLab free to use?",
    answer: "Yes, All the tools published on this website are completely for free.",
  },
  {
    question: "Can I edit resumes after creating them?",
    answer:
      "Yes, after you sign in with Google. The saved resume stays with that account and you can delete it from the resume hub.",
  },
  {
    question: "Can I use the builder on mobile?",
    answer:
      "No, as of now the editor can only be used if you desktop or laptop.",
  },
  {
    question: "Are templates suitable for ATS workflows?",
    answer:
      "Yes in our template gallery we have few templates specifically designed as per the ATS workflow.",
  },
] as const;

const resumeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: resumeFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function ResumeBuilderLandingPage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(resumeFaqSchema) }}
        />
        <section className="text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            Free Online Resume Editor
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Choose and Edit any resume from a resume template or a blank page. Sign in with Google to edit and download it. Download a PDF or a PNG. All the tools available on this website are completely for FREE!
          </p>
          <div className="mt-6">
            <Link
              href="/resume"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Start Building Resume
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <ResumeBuilderIllustration />
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Why People Use StudiosisLab Resume Builder ?">
            <ul className="list-disc space-y-2 pl-5">
              <li>Start from a Resume Template or a blank page.</li>
              <li>Sign in with Google. The resume is saved with that account.</li>
              <li>Download in PDF and PNG format.</li>
              <li>Delete a saved resume from the resume hub.</li>
              <li>Completely for FREE!!</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How It Works ?">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Choose a Resume Template or start from a blank page.</li>
              <li>Just click open any template you like and replace the sample text with your own.</li>
              <li>Download in PDF and PNG format.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Who It Is For ?">
            <p>
              StudiosisLab supports students preparing first resumes, freshers applying to entry roles, professionals updating career documents, freelancers pitching clients, user who wants to build resume using an online editor and career switchers repositioning experience.
            </p>
          </SectionBlock>

          <SectionBlock title="Trust and Security">
            <p>
              A saved resume stays with your Google account. The connection uses HTTPS. StudiosisLab does
              not claim that stored files are encrypted at rest.
            </p>
            <p>
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Read our Security approach
              </Link>
            </p>
          </SectionBlock>
        </section>

        <section className="mt-6">
          <SectionBlock title="Resume Editor FAQ">
            {resumeFaqItems.map((item) => (
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
                href="/blog/how-to-build-a-resume-that-passes-ats-in-2026"
                className="font-medium text-zinc-900 underline"
              >
                How to Structure a Resume for Applicant-Tracking Systems
              </Link>
            </li>
            <li>
              <Link
                href="/blog/resume-summary-examples-for-students-and-freshers"
                className="font-medium text-zinc-900 underline"
              >
                Resume Summary Examples for Students and Freshers
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 text-center shadow-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Ready to build your resume?</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in with Google, edit the Resume Template and download as PDF or PNG.
          </p>
          <div className="mt-5">
            <Link
              href="/resume"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Start Building Resume
            </Link>
          </div>
        </section>
      </article>
    </MarketingPageShell>
  );
}
