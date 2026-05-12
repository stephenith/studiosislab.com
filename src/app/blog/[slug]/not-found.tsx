import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";

export default function BlogArticleNotFound() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-2xl pt-8 text-center text-zinc-900">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Article not found</h1>
        <p className="mt-3 text-sm text-zinc-600 sm:text-base">
          The blog article you are looking for is not available right now.
        </p>
        <div className="mt-6">
          <Link href="/blog" className="text-sm font-medium text-zinc-900 underline">
            Back to blog
          </Link>
        </div>
      </article>
    </MarketingPageShell>
  );
}
