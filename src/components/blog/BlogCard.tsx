import Link from "next/link";
import type { BlogArticle } from "@/data/blog/types";
import ArticleMeta from "@/components/blog/ArticleMeta";

type BlogCardProps = {
  article: BlogArticle;
};

export default function BlogCard({ article }: BlogCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">
        <Link href={`/blog/${article.slug}`} className="hover:underline">
          {article.title}
        </Link>
      </h2>
      <ArticleMeta article={article} />
      <p className="mt-3 text-sm leading-relaxed text-zinc-700 sm:text-base">{article.excerpt}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {article.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 sm:text-xs"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5">
        <Link href={`/blog/${article.slug}`} className="text-sm font-medium text-zinc-900 underline">
          Read article
        </Link>
      </div>
    </article>
  );
}
