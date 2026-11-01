import { PortalLink as Link } from "@/components/portal-link";
import type { activePromotion } from "@workspace/api-zod";
type Offer = NonNullable<ReturnType<typeof activePromotion>>;
/** The same offer card is used in the dealer portal and the staff draft preview. */
export function DealerQuoteOffer({ title, offer, href, preview = false }: { title: string; offer: Offer; href?: string; preview?: boolean }) {
  const expiry = Number.isFinite(Date.parse(offer.endsAt)) ? new Date(offer.endsAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " Eastern" : "";
  const actionClass = "mt-2 inline-flex min-h-11 items-center rounded-lg bg-[#182c3c] px-4 text-sm font-semibold text-white";
  return <section aria-label={preview ? "Discount preview" : "Dealer discount"} className="rounded-2xl border border-[#8ea8bf] bg-[#b9cede] p-5 text-[#182c3c]">
    <p className="text-xs font-semibold uppercase tracking-widest">{preview ? "Draft dealer offer" : "Dealer offer"}</p>
    <h2 className="mt-2 break-words text-2xl font-semibold">{offer.percentOff}% off · {title}</h2>
    <p className="mt-2 text-sm">{offer.collections.join(", ")}{offer.maximumSavings ? ` · Maximum savings $${offer.maximumSavings.toLocaleString()}` : ""}{offer.minimumOrder > 0 ? ` · Minimum order $${offer.minimumOrder.toLocaleString()}` : ""}</p>
    <p className="mt-2 text-xs">{expiry ? `Ends ${expiry}` : "End date required"} · {offer.combinable ? "May combine with other offers" : "Cannot combine with other offers"}</p>
    <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer">Offer terms & eligibility</summary><p className="whitespace-pre-line">{offer.terms}</p></details>
    {preview ? <span className={actionClass}>Request an eligible quote</span> : <Link href={href ?? "/portal/forms"} className={actionClass}>Request an eligible quote</Link>}
    <p className="mt-3 text-xs">Kessick confirms eligibility and savings in your quote.</p>
  </section>;
}
