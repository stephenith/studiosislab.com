import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Games | StudiosisLab",
  description: "Light browser games on StudiosisLab.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
