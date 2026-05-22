import type { Metadata } from "next";
import { ContactMailtoLink } from "@/components/analytics/ContactMailtoLink";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Contact StudiosisLab",
  description:
    "Get in touch with StudiosisLab support for product help, technical issues, and business inquiries.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact StudiosisLab"
      intro="We are committed to responsive, practical support so users can confidently use StudiosisLab for resume, PDF, and e-sign workflows."
    >
      <SectionBlock title="Support Contact">
        <p>
          For account help, product guidance, and technical questions, contact us at{" "}
          <ContactMailtoLink href="mailto:stephen@studiosis.in" linkType="support">
            stephen@studiosis.in
          </ContactMailtoLink>
          .
        </p>
      </SectionBlock>

      <SectionBlock title="Business and Partnership Inquiries">
        <p>
          For partnerships, enterprise use cases, or commercial discussions, reach out at{" "}
          <ContactMailtoLink href="mailto:business@studiosis.in" linkType="business">
            business@studiosis.in
          </ContactMailtoLink>
          .
        </p>
      </SectionBlock>

      <SectionBlock title="Response Time">
        <p>
          We aim to respond to most support requests within 1-2 business days. Complex technical
          issues may take longer when deeper investigation is required, but we will keep you updated
          on progress.
        </p>
      </SectionBlock>

      <SectionBlock title="Issue Reporting">
        <p>
          If you report a bug, please include relevant context such as page URL, browser/device
          details, and a short description of steps to reproduce the issue. This helps us diagnose and
          resolve problems faster.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
