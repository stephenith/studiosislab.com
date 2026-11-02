import type { Metadata } from "next";
import InvoiceEditor from "./InvoiceEditor";

export const metadata: Metadata = {
  title: "Free Invoice Generator | StudiosisLab",
  description: "Create an invoice in this browser and download an A4 PDF. No account and no payment. The invoice is saved in this browser only.",
  alternates: { canonical: "/tools/invoice" },
};

export default function InvoicePage() {
  return <InvoiceEditor />;
}
