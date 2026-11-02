import type { Metadata } from "next";
import BlogCard from "@/components/blog/BlogCard";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import { getAllArticles } from "@/lib/blog";

export const metadata: Metadata = {
  title: "StudiosisLab Blog | Resume, E-Sign & Document Tips",
  description:
    "Read practical guides from StudiosisLab on resumes, e-sign documents, online productivity, and digital document workflows.",
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogIndexPage() {
  const articles = getAllArticles();

  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-4xl pt-2 text-zinc-900 sm:pt-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">StudiosisLab Blog</h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600">
          Guides for writing a resume, signing a PDF, and preparing a freelancer invoice. The invoice
          guide describes the browser tool. The resume guides do not mean a file was tested in an
          applicant-tracking system. Reading times are estimates from the length of the article.
        </p>

        <section className="mt-8 grid gap-5">
          {articles.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </section>
      </article>
    </MarketingPageShell>
  );
}
