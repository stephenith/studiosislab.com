import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Security | StudiosisLab",
  description:
    "How StudiosisLab handles resumes, e-sign PDFs, and invoices, including HTTPS and what deletion does.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Security"
      intro="This page describes the security facts that are visible in the product today. It does not claim that stored files are encrypted at rest."
    >
      <SectionBlock title="Encrypted Connections">
        <p>
          StudiosisLab uses HTTPS to help protect data in transit between your device and our services.
          Secure transport is a baseline requirement for all core user interactions.
        </p>
      </SectionBlock>

      <SectionBlock title="Authentication and Access Control">
        <p>
          Resume editing and the e-sign workspace require Google sign-in. A saved resume and an e-sign
          agreement are tied to that account. The invoice tool does not use an account.
        </p>
      </SectionBlock>

      <SectionBlock title="Document Handling Practices">
        <p>
          A resume is saved so you can reopen it. An e-sign PDF is stored so you can continue the
          agreement and download the finished file. An invoice is saved in the browser where you created
          it.
        </p>
      </SectionBlock>

      <SectionBlock title="Storage and Retention Philosophy">
        <p>
          You can delete a resume from the resume hub and an agreement from the e-sign workspace. You can
          delete an invoice in the invoice tool or its history. Those actions remove the item from that
          place. StudiosisLab does not publish an automatic deletion period. This page does not claim that
          every email copy or backup is erased, or that stored files are encrypted at rest.
        </p>
      </SectionBlock>

      <SectionBlock title="Security Reporting">
        <p>
          If you discover a potential security issue, report it responsibly to{" "}
          <a className="font-medium text-zinc-900 underline" href="mailto:security@studiosislab.com">
            security@studiosislab.com
          </a>
          . Please include reproduction details and impact context. We review all credible reports with
          priority.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
