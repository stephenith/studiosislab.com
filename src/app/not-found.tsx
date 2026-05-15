import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center text-zinc-800">
      <p className="font-heading text-2xl font-semibold tracking-tight">Page not found</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
        The page you requested does not exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800"
      >
        Back to home
      </Link>
      <Link
        href="/help"
        className="mt-3 text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
      >
        Help
      </Link>
      <Link
        href="/contact"
        className="mt-2 text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
      >
        Contact
      </Link>
    </main>
  );
}
