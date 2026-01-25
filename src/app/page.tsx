import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Studiosis Lab</h1>
      <p>Your document editor & e-signature platform.</p>

      <br />

      <Link href="/editor/t002">
        <button
          style={{
            padding: "12px 20px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Open Editor
        </button>
      </Link>
    </main>
  );
}