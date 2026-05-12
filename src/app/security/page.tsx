import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Security | StudiosisLab",
  description:
    "Learn how StudiosisLab approaches security for resumes, PDFs, and e-sign documents, including encrypted connections and responsible data handling.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Security"
      intro="StudiosisLab is built with a trust-first approach for handling resumes, PDFs, and e-sign workflows."
    >
      <SectionBlock title="Encrypted Connections">
        <p>
          StudiosisLab uses HTTPS to help protect data in transit between your device and our services.
          Secure transport is a baseline requirement for all core user interactions.
        </p>
      </SectionBlock>

      <SectionBlock title="Authentication and Access Control">
        <p>
          We use secure authentication flows and access controls to help ensure users can only access
          authorized account resources and document actions.
        </p>
      </SectionBlock>

      <SectionBlock title="Document Handling Practices">
        <p>
          Uploaded files are handled for specific product workflows such as editing, verification, and
          e-sign execution. We continuously evaluate how to reduce unnecessary data exposure while
          preserving required functionality.
        </p>
      </SectionBlock>

      <SectionBlock title="Storage and Retention Philosophy">
        <p>
          Our long-term direction includes stronger retention controls and automatic cleanup options
          where operationally appropriate, helping users manage how long documents remain stored.
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
