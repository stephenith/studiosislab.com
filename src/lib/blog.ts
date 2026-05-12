import { blogArticles } from "@/data/blog/articles";
import type { BlogArticle } from "@/data/blog/types";

function sortByPublishedDateDesc(items: BlogArticle[]) {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getAllArticles() {
  return sortByPublishedDateDesc(blogArticles);
}

export function getArticleBySlug(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}

export function getRelatedArticles(current: BlogArticle, limit = 3) {
  const others = blogArticles.filter((article) => article.slug !== current.slug);

  const scored = others.map((article) => {
    const sharedTags = article.tags.filter((tag) => current.tags.includes(tag)).length;
    const sameCategoryBonus = article.category === current.category ? 2 : 0;
    return {
      article,
      score: sharedTags + sameCategoryBonus,
    };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime()
      );
    })
    .slice(0, limit)
    .map((item) => item.article);
}

export function formatArticleDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
