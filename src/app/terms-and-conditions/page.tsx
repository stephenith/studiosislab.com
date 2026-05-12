import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Terms and Conditions | StudiosisLab",
  description:
    "Review the StudiosisLab Terms and Conditions, including acceptable use, account responsibilities, content ownership, and service limitations.",
  alternates: {
    canonical: "/terms-and-conditions",
  },
};

export default function TermsAndConditionsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      intro="These Terms govern your access to and use of StudiosisLab and related services."
    >
      <SectionBlock title="Acceptable Use">
        <p>
          You agree to use StudiosisLab only for lawful purposes and in a way that does not abuse,
          disrupt, or compromise service quality, infrastructure stability, or other users&apos;
          experience.
        </p>
      </SectionBlock>

      <SectionBlock title="Prohibited Activities">
        <p>
          Prohibited behavior includes unauthorized access attempts, misuse of automated systems to
          overload services, malicious uploads, and use of the platform for fraudulent or illegal
          activity.
        </p>
      </SectionBlock>

      <SectionBlock title="Account Responsibilities">
        <p>
          You are responsible for activity performed through your account and for maintaining secure
          access credentials. If you suspect unauthorized access, contact support promptly.
        </p>
      </SectionBlock>

      <SectionBlock title="User Content and Document Responsibility">
        <p>
          You are responsible for files and content you upload, generate, or share through StudiosisLab.
          You must ensure you have the legal right to use that content and that it does not violate
          third-party rights or applicable law.
        </p>
      </SectionBlock>

      <SectionBlock title="Intellectual Property">
        <p>
          StudiosisLab branding, product design, and platform materials are protected by applicable
          intellectual property laws. Unauthorized reproduction, reverse engineering, or redistribution
          is not permitted unless explicitly authorized.
        </p>
      </SectionBlock>

      <SectionBlock title="Service Availability and Liability">
        <p>
          We work to maintain reliable service, but availability may vary due to maintenance, updates,
          or external factors. StudiosisLab is provided on an as-available basis, and liability is
          limited to the extent permitted by law.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
