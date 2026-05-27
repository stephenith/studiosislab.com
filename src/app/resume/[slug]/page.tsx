import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import {
  getAllPublishedTemplateSeoPages,
  getTemplateSeoById,
  getTemplateSeoBySlug,
} from "@/lib/templateSeo";

type TemplateSeoPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllPublishedTemplateSeoPages().map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: TemplateSeoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getTemplateSeoBySlug(slug);

  if (!page) {
    return {
      title: "Resume Template Not Found | StudiosisLab",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const pageUrl = `/resume/${page.slug}`;
  const imageUrl = page.thumbnailPath;

  return {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      title: page.seoTitle,
      description: page.seoDescription,
      url: pageUrl,
      images: [
        {
          url: imageUrl,
          alt: `${page.templateTitle} preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.seoTitle,
      description: page.seoDescription,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function TemplateSeoPage({ params }: TemplateSeoPageProps) {
  const { slug } = await params;
  const page = getTemplateSeoBySlug(slug);
  if (!page) notFound();

  const relatedTemplates = page.relatedTemplateIds
    .map((templateId) => getTemplateSeoById(templateId))
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((item) => item.slug !== page.slug);

  const absoluteUrl = `https://studiosislab.com/resume/${page.slug}`;
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.seoDescription,
    url: absoluteUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "StudiosisLab",
      url: "https://studiosislab.com",
    },
  };

  const faqJsonLd = page.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl text-zinc-900">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }} />
        {faqJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        ) : null}

        <header className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
            {page.h1}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">{page.intro}</p>

          <div className="mt-6 grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <Image
                src={page.thumbnailPath}
                alt={`${page.templateTitle} resume template preview`}
                width={420}
                height={594}
                className="h-auto w-full"
                sizes="(min-width: 768px) 260px, 100vw"
                priority
              />
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/editor/template/${page.templateId}`}
                className="inline-flex w-fit items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Use this template
              </Link>
              <Link
                href="/resume"
                className="inline-flex w-fit items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                Browse all resumes
              </Link>
              <p className="text-sm text-zinc-600">
                Template ID: {page.templateId} · Category: {page.templateCategory || "Resume"}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
            Who this resume is for
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 sm:text-base">
            {page.bestFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
            What to include
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 sm:text-base">
            {page.whatToInclude.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">ATS tips</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 sm:text-base">
            {page.atsTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
            Resume writing tips
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 sm:text-base">
            {page.writingTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {relatedTemplates.length ? (
          <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
              Related resume templates
            </h2>
            <ul className="mt-4 space-y-2 text-sm sm:text-base">
              {relatedTemplates.map((item) => (
                <li key={item.templateId}>
                  <Link href={`/resume/${item.slug}`} className="font-medium text-zinc-900 underline">
                    {item.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {page.faq.length ? (
          <section className="mt-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">FAQ</h2>
            <div className="mt-4 space-y-4">
              {page.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-base font-semibold text-zinc-900">{item.question}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700 sm:text-base">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </MarketingPageShell>
  );
}
