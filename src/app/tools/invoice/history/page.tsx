import type { Metadata } from "next";
import InvoiceHistoryClient from "../InvoiceHistoryClient";

export const metadata: Metadata = {
  title: "Invoice history | StudiosisLab",
  description: "Reopen, duplicate, or delete invoices saved in this browser, and export a backup.",
  robots: { index: false, follow: false },
};

export default function InvoiceHistoryPage() {
  return <InvoiceHistoryClient />;
}
