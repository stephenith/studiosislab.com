import type { BlogArticle } from "@/data/blog/types";
import { formatArticleDate } from "@/lib/blog";

type ArticleMetaProps = {
  article: BlogArticle;
};

export default function ArticleMeta({ article }: ArticleMetaProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 sm:text-sm">
      <span>{formatArticleDate(article.publishedAt)}</span>
      <span aria-hidden>•</span>
      <span>{article.readTime}</span>
      <span aria-hidden>•</span>
      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 sm:text-xs">
        {article.category}
      </span>
    </div>
  );
}
