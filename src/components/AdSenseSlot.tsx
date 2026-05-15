"use client";

import { useEffect } from "react";

function isLiveAdConfig(client: string, slot: string): boolean {
  if (!client || !slot) return false;
  const c = client.toLowerCase();
  const s = slot.toLowerCase();
  if (c.includes("test") || c.includes("placeholder") || s.includes("test") || s.includes("placeholder")) {
    return false;
  }
  return client.startsWith("ca-pub-");
}

type Props = {
  /** AdSense client id, e.g. ca-pub-1234567890 */
  client: string;
  /** Ad unit slot id */
  slot: string;
  style?: React.CSSProperties;
  className?: string;
};

/**
 * Renders an AdSense unit only when client + slot look like real production values.
 * Otherwise renders nothing (no placeholder UI in public builds).
 */
export default function AdSenseSlot({ client, slot, style, className }: Props) {
  const live = isLiveAdConfig(client, slot);

  useEffect(() => {
    if (!live) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AdSense global when script loaded
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [client, slot, live]);

  if (!live) return null;

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block", height: 220, ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
