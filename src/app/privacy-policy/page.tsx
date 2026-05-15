import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Privacy Policy | StudiosisLab",
  description:
    "Read the StudiosisLab Privacy Policy covering data collection, authentication, document handling, cookies, analytics, optional advertising, and user rights.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      intro="This Privacy Policy explains how StudiosisLab collects, uses, and protects information when you use our resume, PDF, and e-sign features."
    >
      <SectionBlock title="Information We Collect">
        <p>
          We collect information needed to operate StudiosisLab, including account identifiers,
          profile details associated with sign-in, and files or document metadata required for product
          functionality.
        </p>
      </SectionBlock>

      <SectionBlock title="Authentication and Account Data">
        <p>
          StudiosisLab currently supports Google-based authentication. When you sign in, we receive
          profile information such as name, email, and account identifier needed to personalize access
          and securely associate your data with your account.
        </p>
      </SectionBlock>

      <SectionBlock title="Uploaded Documents and Generated Files">
        <p>
          Files you upload (such as resumes, PDFs, and e-sign documents) are processed to deliver
          requested features. Document data may be stored so you can continue work, review history, or
          access finalized outputs within the product.
        </p>
      </SectionBlock>

      <SectionBlock title="Cookies and Analytics">
        <p>
          We may use cookies and similar technologies to maintain sessions, improve reliability, and
          understand usage patterns. We may also use analytics tools to evaluate product performance
          and improve user experience.
        </p>
      </SectionBlock>

      <SectionBlock title="Advertising and related technologies">
        <p>
          StudiosisLab may be supported in part by advertising so we can keep core tools free or low
          cost. If we show ads, they may be served through advertising partners or platforms (for
          example, Google AdSense or similar services). Those partners may use cookies, pixels, or
          similar technologies to measure delivery and help prevent abuse. We do not sell your personal
          information to advertisers.
        </p>
        <p>
          You can manage many browser-level cookie preferences in your browser settings. For
          analytics, we aim to use privacy-conscious configurations where available. If our ad or
          analytics setup changes in a material way, we will update this policy to reflect it.
        </p>
      </SectionBlock>

      <SectionBlock title="Infrastructure and Third-Party Services">
        <p>
          StudiosisLab relies on modern infrastructure providers, including Firebase services for
          authentication, storage, and application data handling. We only use third-party integrations
          that support core platform operations and service quality.
        </p>
      </SectionBlock>

      <SectionBlock title="Security Practices">
        <p>
          We apply security-focused practices to reduce risk, including controlled access, secure
          transport, and operational safeguards. No system is completely risk-free, but we design with
          trust and responsible handling as core requirements.
        </p>
      </SectionBlock>

      <SectionBlock title="Your Rights and Data Requests">
        <p>
          You may request account-related privacy support, including data review or deletion requests,
          by contacting{" "}
          <a className="font-medium text-zinc-900 underline" href="mailto:privacy@studiosislab.com">
            privacy@studiosislab.com
          </a>
          . We will review requests in line with applicable legal and operational obligations.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
