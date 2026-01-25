"use client";

import Link from "next/link";
import { TEMPLATES } from "../../data/templates";

export default function AppHomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Studiosis Lab — Templates</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Click any template to open the editor.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 520 }}>
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/app/editor/${t.id}`}
            style={{
              display: "block",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 14,
              textDecoration: "none",
              color: "black",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              Category: {t.category} • ID: {t.id}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}