import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Document Tools | StudiosisLab",
  description:
    "Access StudiosisLab tools for e-signing documents and managing digital workflows online.",
  alternates: {
    canonical: "/tools",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
