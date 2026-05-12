import type { ReactNode } from "react";
import type { BlogArticle } from "@/data/blog/types";
import ArticleMeta from "@/components/blog/ArticleMeta";

type BlogArticleLayoutProps = {
  article: BlogArticle;
  children: ReactNode;
};

export default function BlogArticleLayout({ article, children }: BlogArticleLayoutProps) {
  return (
    <article className="mx-auto w-full max-w-3xl pt-2 text-zinc-900 sm:pt-4">
      <header>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{article.title}</h1>
        <ArticleMeta article={article} />
        <p className="mt-4 text-base leading-relaxed text-zinc-600">{article.description}</p>
      </header>
      <div className="mt-8 space-y-8">{children}</div>
    </article>
  );
}
