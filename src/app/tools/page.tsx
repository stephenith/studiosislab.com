"use client";

import Link from "next/link";

export default function ToolsPage() {
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      {/* PAGE TITLE */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          Free Tools
        </h1>
        <p style={{ marginTop: 6, color: "#555", fontSize: 15 }}>
          Pick a tool to get started.
        </p>
      </div>

      {/* TOOL LIST GRID */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {/* DOCUSIGN TOOL */}
        <Link
          href="/api/docusign/login"
          style={{
            display: "block",
            border: "1px solid #ddd",
            borderRadius: 14,
            padding: 18,
            textDecoration: "none",
            color: "black",
            background: "white",
            transition: "0.2s",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 17 }}>DocuSign</div>
          <div
            style={{
              fontSize: 14,
              color: "#666",
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            Sign documents online instantly
          </div>
        </Link>

        {/* FUTURE PLACEHOLDERS */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            background: "#fafafa",
            color: "#777",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          More tools coming soon…
        </div>
      </div>
    </main>
  );
}