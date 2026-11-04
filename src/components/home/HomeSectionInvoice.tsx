import { HomeCtaLink } from "@/components/analytics/HomeCtaLink";

const INVOICE_ILLUSTRATION_SRC = "/dock/invoice.svg";

const ILLUSTRATION_FRAME =
  "relative h-[min(40vh,460px)] w-full max-w-3xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionInvoice() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <img
          src={INVOICE_ILLUSTRATION_SRC}
          alt="Illustration of an invoice"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain object-center"
          style={{ transform: "scale(0.9) translateZ(0)" }}
        />
      </div>
      <HomeCtaLink href="/tools/invoice" surface="home_invoice" className={CTA_CLASS}>
        Make an invoice
      </HomeCtaLink>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          Invoice
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          Invoice is tool where any user can come and generate invoices for the enterprise or for their freelancing project and customise it according to their brand with auto summing and supporting multiple currency options.
        </p>
      </div>
    </div>
  );
}
