import type { Metadata } from "next";
import ToolsHubClient from "./ToolsHubClient";

export const metadata: Metadata = {
  title: "Online Document Tools | StudiosisLab",
  description:
    "Sign in with Google to upload a PDF of up to 50 MB, place signatures, and download the finished file.",
  alternates: {
    canonical: "/tools",
  },
};

export default function ToolsPage() {
  return <ToolsHubClient />;
}
