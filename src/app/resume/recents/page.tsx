import type { Metadata } from "next";
import ResumeRecentsClient from "./ResumeRecentsClient";

export const metadata: Metadata = {
  title: "Recent resumes | StudiosisLab",
  description: "Continue editing your saved resume drafts on StudiosisLab.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/resume/recents",
  },
};

export default function ResumeRecentsPage() {
  return <ResumeRecentsClient />;
}
