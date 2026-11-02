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
      "The resume editor, e-sign workspace, and invoice tool are free to use. No payment is required for the features available today. This does not promise that every future feature will be free.",
  },
  {
    question: "Are uploaded files secure?",
    answer:
      "Resume and e-sign files are available after you sign in with Google. Pages are served over HTTPS. Invoices stay in this browser and are not stored in your account. This is not a claim that stored files are encrypted at rest.",
  },
  {
    question: "Can I download my resumes and documents?",
    answer:
      "A resume downloads as a PDF, or as a PNG on a larger screen. A signed agreement downloads as a PDF. An invoice downloads as an A4 PDF.",
  },
  {
    question: "How does e-signing work on StudiosisLab?",
    answer:
      "Sign in with Google, upload a PDF of up to 50 MB, place signatures, and download the finished PDF. A completion email attaches the PDF when it is 20 MB or less, and includes a download link when it is larger. You can delete the agreement from the e-sign workspace.",
  },
  {
    question: "Do files stay stored permanently?",
    answer:
      "You can delete a resume from the resume hub and an agreement from the e-sign workspace. You can delete an invoice in the invoice tool or its history. StudiosisLab does not publish an automatic deletion period. Deleting in the product removes the item from that place. It is not a claim that every email or backup copy is erased.",
  },
  {
    question: "Is login required to use StudiosisLab?",
    answer:
      "Google sign-in is required to edit a resume and to use the e-sign workspace. The invoice tool does not require an account. Guides, the blog, and Resume Template pages can be read without signing in.",
  },
  {
    question: "Can I use StudiosisLab on mobile devices?",
    answer:
      "On a phone, a Resume Template opened from the hub uses a simpler editor and downloads as a PDF. The fuller resume editor asks for a tablet or a larger screen. E-sign and the invoice tool open in the browser.",
  },
  {
    question: "Are resume templates ATS-friendly?",
    answer:
      "StudiosisLab does not test Resume Templates in applicant-tracking systems. Read the downloaded PDF before you submit it.",
  },
  {
    question: "Where is my invoice saved?",
    answer:
      "In this browser on this device. It is not saved to a StudiosisLab account. Another browser cannot open it. Clearing this site's data removes it. Download the A4 PDF, or export a backup from History, before you clear site data.",
  },
  {
    question: "What file do I need for e-sign?",
    answer: "A PDF of 50 MB or less. Other file types are not accepted. Google sign-in is required.",
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
      intro="Answers about the resume editor, e-sign workspace, and invoice tool: what you need, what you get back, and where the file stays."
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {faqItems.map((item) => (
        <SectionBlock key={item.question} title={item.question}>
          <p>{item.answer}</p>
        </SectionBlock>
      ))}
    </LegalPageShell>
  );
}
