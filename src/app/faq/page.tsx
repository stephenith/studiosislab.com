import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "FAQ | StudiosisLab",
  description:
    "Frequently asked questions about StudiosisLab pricing, document security, resume downloads, e-sign flows, storage, and mobile usage.",
  alternates: {
    canonical: "/faq",
  },
};

const faqItems = [
  {
    question: "Is StudiosisLab free to use?",
    answer:
      "StudiosisLab currently offers free access to core product experiences, including resume and document workflows. Pricing and premium plans may evolve as platform capabilities expand.",
  },
  {
    question: "Are uploaded files secure?",
    answer:
      "We use secure connections and controlled access practices to protect uploaded files. We continue improving security controls to support trust-first document handling.",
  },
  {
    question: "Can I download my resumes and documents?",
    answer:
      "Yes. StudiosisLab is designed to let users create and export practical outputs, including resume files and e-sign related documents.",
  },
  {
    question: "How does e-signing work on StudiosisLab?",
    answer:
      "You can upload a document, prepare it for signing, and use built-in flows for signature placement and verification. Document status and history are surfaced through the e-sign workspace.",
  },
  {
    question: "Do files stay stored permanently?",
    answer:
      "Document retention depends on product behavior and workflow requirements. We are actively moving toward stronger retention controls, including safer long-term cleanup options.",
  },
  {
    question: "Is login required to use StudiosisLab?",
    answer:
      "Some capabilities require authentication to protect account-linked data and document access. Public browsing and feature visibility may still be available without sign-in.",
  },
  {
    question: "Can I use StudiosisLab on mobile devices?",
    answer:
      "Yes. StudiosisLab supports modern mobile browsers, though some advanced editing experiences are more efficient on larger screens.",
  },
  {
    question: "Are resume templates ATS-friendly?",
    answer:
      "StudiosisLab includes templates designed for practical readability and professional structure. ATS compatibility can vary by employer system, so users should review exported content and formatting before final submission.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <LegalPageShell
      title="Frequently Asked Questions"
      intro="Quick answers to common questions about StudiosisLab features, data handling, and everyday usage."
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <SectionBlock title="Is StudiosisLab free to use?">
        <p>
          StudiosisLab currently offers free access to core product experiences, including resume and
          document workflows. Pricing and premium plans may evolve as platform capabilities expand.
        </p>
      </SectionBlock>

      <SectionBlock title="Are uploaded files secure?">
        <p>
          We use secure connections and controlled access practices to protect uploaded files. We
          continue improving security controls to support trust-first document handling.
        </p>
      </SectionBlock>

      <SectionBlock title="Can I download my resumes and documents?">
        <p>
          Yes. StudiosisLab is designed to let users create and export practical outputs, including
          resume files and e-sign related documents.
        </p>
      </SectionBlock>

      <SectionBlock title="How does e-signing work on StudiosisLab?">
        <p>
          You can upload a document, prepare it for signing, and use built-in flows for signature
          placement and verification. Document status and history are surfaced through the e-sign
          workspace.
        </p>
      </SectionBlock>

      <SectionBlock title="Do files stay stored permanently?">
        <p>
          Document retention depends on product behavior and workflow requirements. We are actively
          moving toward stronger retention controls, including safer long-term cleanup options.
        </p>
      </SectionBlock>

      <SectionBlock title="Is login required to use StudiosisLab?">
        <p>
          Some capabilities require authentication to protect account-linked data and document access.
          Public browsing and feature visibility may still be available without sign-in.
        </p>
      </SectionBlock>

      <SectionBlock title="Can I use StudiosisLab on mobile devices?">
        <p>
          Yes. StudiosisLab supports modern mobile browsers, though some advanced editing experiences
          are more efficient on larger screens.
        </p>
      </SectionBlock>

      <SectionBlock title="Are resume templates ATS-friendly?">
        <p>
          StudiosisLab includes templates designed for practical readability and professional structure.
          ATS compatibility can vary by employer system, so users should review exported content and
          formatting before final submission.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
