export type ArticleCategory = "Resume" | "E-Sign" | "Productivity";

export type ArticleSectionLink = {
  label: string;
  href: string;
};

export type ArticleSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  links?: ArticleSectionLink[];
};

export type ArticleFaqItem = {
  question: string;
  answer: string;
};

export type ArticleCta = {
  label: string;
  href: string;
  note?: string;
};

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  updatedAt?: string;
  category: ArticleCategory;
  tags: string[];
  readTime: string;
  sections: ArticleSection[];
  faq?: ArticleFaqItem[];
  relatedResumeTemplateIds?: string[];
  cta: ArticleCta;
};
