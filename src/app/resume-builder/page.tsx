import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";
import ResumeBuilderIllustration from "@/components/marketing/illustrations/ResumeBuilderIllustration";

export const metadata: Metadata = {
  title: "Free Online Resume Builder | StudiosisLab",
  description:
    "Create professional resumes online with StudiosisLab’s simple resume builder, editable templates, and fast document workflow.",
  alternates: {
    canonical: "/resume-builder",
  },
};

const resumeFaqItems = [
  {
    question: "Is StudiosisLab free to use?",
    answer: "StudiosisLab currently provides free access to core resume workflows.",
  },
  {
    question: "Can I edit resumes after creating them?",
    answer: "Yes. You can continue editing and refining resume content before final export.",
  },
  {
    question: "Can I use the builder on mobile?",
    answer: "Yes, though detailed editing is generally smoother on larger screens.",
  },
  {
    question: "Are templates suitable for ATS workflows?",
    answer:
      "Templates are designed for clear structure and readability. Compatibility can vary by employer system, so always review your final export.",
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
            Free Online Resume Builder
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
            Build modern resumes online with a simple workflow designed for students, freshers,
            professionals, and active job seekers.
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
          <SectionBlock title="Why People Use StudiosisLab Resume Builder">
            <ul className="list-disc space-y-2 pl-5">
              <li>Clean resume templates built for practical job applications.</li>
              <li>Edit content online without complicated setup.</li>
              <li>Designed for students, freshers, and experienced professionals.</li>
              <li>Fast workflow focused on export and submission readiness.</li>
              <li>Simple UI that keeps writing and layout decisions clear.</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="How It Works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Choose a template that matches your profile and role.</li>
              <li>Customize your details, projects, and experience sections.</li>
              <li>Download your resume or continue refining it in the editor.</li>
            </ol>
          </SectionBlock>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <SectionBlock title="Who It Is For">
            <p>
              StudiosisLab supports students preparing first resumes, freshers applying to entry roles,
              professionals updating career documents, freelancers pitching clients, and career
              switchers repositioning experience.
            </p>
          </SectionBlock>

          <SectionBlock title="Trust and Security">
            <p>
              Resume workflows run with account-based access and secure connections. We are committed
              to responsible handling of user documents and clear privacy practices.
            </p>
            <p>
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Read our Security approach
              </Link>
            </p>
          </SectionBlock>
        </section>

        <section className="mt-6">
          <SectionBlock title="Resume Builder FAQ">
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
                How to Build a Resume That Passes ATS in 2026
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
            Start in minutes and keep full control over your content and structure.
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
