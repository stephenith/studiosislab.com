"use client";

import { useRouter } from "next/navigation";

export default function EditorDefault() {
  const router = useRouter();

  // When user visits /editor, send them to /editor/new
  // This will become the main resume editor later.
  router.push("/editor/new");

  return (
    <main className="w-full min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Loading Editor...</p>
    </main>
  );
}