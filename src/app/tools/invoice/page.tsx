import type { Metadata } from "next";
import InvoiceEditor from "./InvoiceEditor";

export const metadata: Metadata = {
  title: "Free Invoice Generator | StudiosisLab",
  description: "Create a professional invoice in the browser, preview it as you type, and download an A4 PDF. No account required.",
  alternates: { canonical: "/tools/invoice" },
};

export default function InvoicePage() {
  return <InvoiceEditor />;
}
