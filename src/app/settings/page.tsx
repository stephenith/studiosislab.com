import type { Metadata } from "next";
import SettingsPageContent from "@/components/settings/SettingsPageContent";

export const metadata: Metadata = {
  title: "Settings | StudiosisLab",
  description: "Manage your StudiosisLab account and preferences.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/settings",
  },
};

export default function SettingsPage() {
  return <SettingsPageContent />;
}
