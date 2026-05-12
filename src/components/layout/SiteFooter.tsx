import Link from "next/link";

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Resume Builder", href: "/resume-builder" },
      { label: "E-Sign Online", href: "/esign-online" },
      { label: "Tools", href: "/tools" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
      { label: "Help Center", href: "/help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
      { label: "Security", href: "/security" },
      { label: "FAQ", href: "/faq" },
    ],
  },
] as const;

export default function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-zinc-200/80 bg-transparent pt-8 text-sm">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-zinc-500 transition-colors hover:text-zinc-950">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mt-8 pb-2 text-xs text-zinc-400">
        StudiosisLab — modern tools for resumes, documents, and e-sign workflows.
      </p>
    </footer>
  );
}
