"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendSpaPageView } from "@/lib/analytics";

/**
 * Sends GA4 `page_view` on App Router client navigations only.
 * Initial full page load is counted by `gtag('config', …)` in GoogleAnalytics — we skip the first run to avoid double-counting.
 */
export function GoogleAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastFullPath = useRef<string | null>(null);

  const search = searchParams.toString();
  const fullPath = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (lastFullPath.current === null) {
      lastFullPath.current = fullPath;
      return;
    }
    if (lastFullPath.current === fullPath) return;
    lastFullPath.current = fullPath;
    sendSpaPageView(fullPath);
  }, [fullPath]);

  return null;
}
