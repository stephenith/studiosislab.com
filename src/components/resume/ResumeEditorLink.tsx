"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  editorHrefForViewport,
  PHONE_EDITOR_MEDIA_QUERY,
  phoneEditorViewportMatch,
  type EditorOpenTarget,
} from "@/lib/editor/phoneEditorRoute";

type ResumeEditorLinkProps = EditorOpenTarget & {
  className?: string;
  children: ReactNode;
};

/**
 * Server-rendered template pages use this so a phone and a laptop
 * follow the same editor decision as the Resume Hub.
 */
export default function ResumeEditorLink({
  templateId,
  docId,
  blank,
  className,
  children,
}: ResumeEditorLinkProps) {
  const router = useRouter();
  const target = { templateId, docId, blank };
  const [href, setHref] = useState(() => editorHrefForViewport(target, false));

  useEffect(() => {
    const media = window.matchMedia(PHONE_EDITOR_MEDIA_QUERY);
    const sync = () => setHref(editorHrefForViewport(target, phoneEditorViewportMatch()));
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [blank, docId, templateId]);

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        const next = editorHrefForViewport(target, phoneEditorViewportMatch());
        if (next === href) return;
        event.preventDefault();
        router.push(next);
      }}
    >
      {children}
    </Link>
  );
}
