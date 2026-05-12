import Link from "next/link";
import type { BlogArticle } from "@/data/blog/types";
import ArticleMeta from "@/components/blog/ArticleMeta";

type RelatedArticlesProps = {
  articles: BlogArticle[];
};

export default function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">
        Related articles
      </h2>
      <div className="mt-4 space-y-4">
        {articles.map((article) => (
          <article key={article.slug} className="rounded-xl border border-zinc-200 p-4">
            <h3 className="font-medium text-zinc-900">
              <Link href={`/blog/${article.slug}`} className="hover:underline">
                {article.title}
              </Link>
            </h3>
            <ArticleMeta article={article} />
            <p className="mt-2 text-sm text-zinc-600">{article.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
