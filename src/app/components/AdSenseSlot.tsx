"use client";

import { useEffect, useRef } from "react";

type Props = {
  slot?: string; // optional for now
  format?: string; // e.g. "auto"
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
};

export default function AdSenseSlot({
  slot = "0000000000", // placeholder until you get real slot id
  format = "auto",
  fullWidthResponsive = true,
  style,
}: Props) {
  const pushedRef = useRef(false);

  useEffect(() => {
    // If AdSense script is not loaded yet, do nothing.
    // This prevents console errors in dev.
    const w = window as any;
    if (!w.adsbygoogle) return;

    // Prevent pushing multiple times (React strict mode / re-renders)
    if (pushedRef.current) return;
    pushedRef.current = true;

    try {
      w.adsbygoogle.push({});
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{
        display: "block",
        width: "100%",
        minHeight: 120,
        ...style,
      }}
      data-ad-client="ca-pub-TESTING_PLACEHOLDER"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
}