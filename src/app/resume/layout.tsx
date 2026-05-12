import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Templates & Builder | StudiosisLab",
  description:
    "Browse resume templates and start creating professional resumes online with StudiosisLab.",
  alternates: {
    canonical: "/resume",
  },
};

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
