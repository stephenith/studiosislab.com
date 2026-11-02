import type { Metadata } from "next";
import Link from "next/link";
import MarketingPageShell from "@/components/layout/MarketingPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "Help Center | StudiosisLab",
  description:
    "Find support and guidance for StudiosisLab resume tools, e-sign documents, account access, privacy, and downloads.",
  alternates: {
    canonical: "/help",
  },
};

export default function HelpCenterPage() {
  return (
    <MarketingPageShell>
      <article className="mx-auto w-full max-w-3xl pt-2 text-zinc-900 sm:pt-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Help Center</h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600">
          Find quick guidance for using StudiosisLab tools, managing documents, and understanding
          account, privacy, and support options.
        </p>

        <div className="mt-8 space-y-6">
          <SectionBlock title="Account & Login">
            <p>
              Sign in with Google to reopen a saved resume or e-sign agreement. Use the same account you
              used when you created it. The invoice tool does not use this account.
            </p>
            <p>
              <Link href="/login" className="font-medium text-zinc-900 underline">
                Go to Login
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Resume Builder">
            <p>
              Open a Resume Template, sign in with Google, edit, and download a PDF. A larger screen can
              also download a PNG. On a phone, open the Resume Template from the hub. Delete a saved resume
              from the hub. No payment is required for these features today.
            </p>
            <p>
              <Link href="/resume-builder" className="font-medium text-zinc-900 underline">
                Resume Builder Overview
              </Link>{" "}
              ·{" "}
              <Link href="/resume" className="font-medium text-zinc-900 underline">
                Open Resume Tool
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="E-Sign Documents">
            <p>
              Sign in with Google and upload a PDF of up to 50 MB. Place signatures, download the finished
              PDF, or delete the agreement from the workspace. Other file types are not accepted.
            </p>
            <p>
              <Link href="/esign-online" className="font-medium text-zinc-900 underline">
                E-Sign Overview
              </Link>{" "}
              ·{" "}
              <Link href="/tools" className="font-medium text-zinc-900 underline">
                Open E-Sign Tool
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Privacy & Security">
            <p>
              Resume and e-sign files stay with your Google account. Invoices stay in this browser. Pages
              use HTTPS. The privacy and security pages describe what deletion does, and they do not claim
              that stored files are encrypted at rest.
            </p>
            <p>
              <Link href="/privacy-policy" className="font-medium text-zinc-900 underline">
                Privacy Policy
              </Link>{" "}
              ·{" "}
              <Link href="/security" className="font-medium text-zinc-900 underline">
                Security
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Downloads & Exports">
            <p>
              Resume: PDF, and PNG on a larger screen. E-sign: PDF. Invoice: A4 PDF. The invoice is saved
              in this browser only. Open the invoice tool without signing in.
            </p>
          </SectionBlock>

          <SectionBlock title="Guides & Tutorials">
            <p>
              Read practical guides on resume writing, document workflows, and e-sign best practices in
              the StudiosisLab blog.
            </p>
            <p>
              <Link href="/tools/invoice" className="font-medium text-zinc-900 underline">
                Open the invoice tool
              </Link>
              {" · "}
              <Link href="/blog" className="font-medium text-zinc-900 underline">
                Visit the StudiosisLab Blog
              </Link>
            </p>
          </SectionBlock>

          <SectionBlock title="Contact Support">
            <p>
              If you need help with account access, files, or workflow issues, contact our support
              team.
            </p>
            <p>
              <Link href="/contact" className="font-medium text-zinc-900 underline">
                Contact StudiosisLab
              </Link>
            </p>
          </SectionBlock>
        </div>
      </article>
    </MarketingPageShell>
  );
}
