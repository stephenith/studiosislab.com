"use client";

import { useEffect } from "react";

type Props = {
  /** Example: "ca-pub-1234567890" (you can keep dummy for now) */
  client: string;
  /** Example: "1234567890" (you can keep dummy for now) */
  slot: string;
  style?: React.CSSProperties;
  className?: string;
};

export default function AdSenseSlot({ client, slot, style, className }: Props) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [client, slot]);

  // If you haven't added real IDs yet, just show a clean placeholder box
  const isPlaceholder =
    !client ||
    client.includes("TEST") ||
    client.includes("PLACEHOLDER") ||
    !slot ||
    slot.includes("TEST") ||
    slot.includes("PLACEHOLDER");

  if (isPlaceholder) {
    return (
      <div
        className={className}
        style={{
          height: 220,
          borderRadius: 12,
          background: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#52525b",
          ...style,
        }}
      >
        Ad will appear here (add AdSense client + slot later)
      </div>
    );
  }

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