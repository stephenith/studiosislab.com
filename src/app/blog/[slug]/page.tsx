import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogArticleLayout from "@/components/blog/BlogArticleLayout";
import BlogCTA from "@/components/blog/BlogCTA";
import RelatedArticles from "@/components/blog/RelatedArticles";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import { getAllArticles, getArticleBySlug, getRelatedArticles } from "@/lib/blog";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found | StudiosisLab Blog",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${article.title} | StudiosisLab Blog`,
    description: article.description,
    alternates: {
      canonical: `/blog/${article.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) notFound();

  const related = getRelatedArticles(article, 3);
  const articleUrl = `https://studiosislab.com/blog/${article.slug}`;
  const dateModified = article.updatedAt ?? article.publishedAt;

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified,
    author: {
      "@type": "Organization",
      name: "StudiosisLab",
    },
    publisher: {
      "@type": "Organization",
      name: "StudiosisLab",
    },
    url: articleUrl,
  };

  return (
    <MarketingPageShell>
      <BlogArticleLayout article={article}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
        />

        {article.sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-6"
          >
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 sm:text-base">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {section.links?.length ? (
                <p className="flex flex-wrap gap-2">
                  {section.links.map((link) => (
                    <Link key={link.href} href={link.href} className="font-medium text-zinc-900 underline">
                      {link.label}
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
          </section>
        ))}

        <BlogCTA cta={article.cta} />
        <RelatedArticles articles={related} />
      </BlogArticleLayout>
    </MarketingPageShell>
  );
}
