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
          Practical guidance for resume writing, e-sign workflows, and modern document productivity.
          Learn faster with clear, implementation-ready articles connected to StudiosisLab tools.
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
