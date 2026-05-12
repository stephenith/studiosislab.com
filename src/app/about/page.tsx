import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import SectionBlock from "@/components/legal/SectionBlock";

export const metadata: Metadata = {
  title: "About StudiosisLab",
  description:
    "Learn about StudiosisLab, our mission, and how we build modern resume, document, and e-sign tools for students, professionals, and teams.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <LegalPageShell
      title="About StudiosisLab"
      intro="StudiosisLab is a modern document productivity platform built to make important workflows faster, cleaner, and more accessible online."
    >
      <SectionBlock title="What StudiosisLab Is">
        <p>
          StudiosisLab brings resume creation, PDF-oriented workflows, and e-signing together in one
          lightweight web experience. Instead of moving across multiple fragmented tools, users can
          complete core document tasks in a single environment.
        </p>
      </SectionBlock>

      <SectionBlock title="Who We Build For">
        <p>
          We design StudiosisLab for students launching their careers, professionals optimizing their
          job materials, and businesses that need clear and dependable document operations. The
          product is intentionally simple so people can focus on outcomes, not software complexity.
        </p>
      </SectionBlock>

      <SectionBlock title="Our Product Direction">
        <p>
          Current focus areas include practical resume tools, PDF workflows, and e-sign capabilities
          that support real day-to-day work. We prioritize speed, usability, and trust so that
          important files and agreements can be handled with confidence.
        </p>
      </SectionBlock>

      <SectionBlock title="Mission and Vision">
        <p>
          Our mission is to make professional document workflows accessible to everyone through
          modern, reliable, and affordable web tools. Our long-term vision is to expand StudiosisLab
          into a broader ecosystem of productivity solutions that stay simple, transparent, and
          user-first.
        </p>
      </SectionBlock>
    </LegalPageShell>
  );
}
