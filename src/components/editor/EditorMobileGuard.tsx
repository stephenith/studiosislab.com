"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PHONE_EDITOR_MEDIA_QUERY,
  phoneEditorHrefFromDesktopPath,
  phoneEditorViewportMatch,
} from "@/lib/editor/phoneEditorRoute";

type EditorMobileGuardProps = {
  children: ReactNode;
};

export default function EditorMobileGuard({ children }: EditorMobileGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPhone, setIsPhone] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(PHONE_EDITOR_MEDIA_QUERY);
    const sync = () => {
      const phone = phoneEditorViewportMatch();
      setIsPhone(phone);
      setChecked(true);
      if (!phone) return;
      const href = phoneEditorHrefFromDesktopPath(`${pathname}${window.location.search}`);
      if (href) router.replace(href);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#ebecf0] text-zinc-600 text-sm">
        Loading editor...
      </div>
    );
  }

  if (isPhone) {
    return (
      <main className="h-screen flex items-center justify-center bg-[#ebecf0] px-4">
        <p className="text-sm text-zinc-600">Opening the phone editor…</p>
      </main>
    );
  }

  return <>{children}</>;
}
