import { useMemo, useState } from "react";
import { useGetDealerPortalPricing } from "@workspace/api-client-react";
import {
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Search,
} from "lucide-react";
import { usePortalContent, type PortalContent } from "@/hooks/use-portal-v2";
import { Input } from "@/components/ui/input";

type PriceLine = {
  sku?: unknown;
  pricingStatus?: unknown;
  wholesaleAmount?: unknown;
  currency?: unknown;
  pricebookId?: unknown;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function contentUrl(content: PortalContent) {
  return typeof content.payload?.url === "string" && content.payload.url.trim()
    ? content.payload.url.trim()
    : null;
}

export default function PortalPricing() {
  // Keep the legacy pricing endpoint as the source of line items. It applies
  // account and multi-group overrides, which a v2 content-only list cannot.
  const pricingQuery = useGetDealerPortalPricing();
  const contentQuery = usePortalContent("price_book");
  const [search, setSearch] = useState("");

  const pricing = (pricingQuery.data ?? []) as PriceLine[];
  const priceBooks = useMemo(() => {
    const currentPricebookIds = new Set(
      pricing
        .map((line) => String(line.pricebookId ?? ""))
        .filter(Boolean),
    );
    return (contentQuery.data?.content ?? []).filter((content) => {
      const linkedId =
        typeof content.payload?.legacyId === "string"
          ? content.payload.legacyId
          : null;
      return !linkedId || !currentPricebookIds.has(linkedId);
    });
  }, [contentQuery.data?.content, pricing]);

  const needle = search.trim().toLowerCase();
  const filteredPricing = useMemo(
    () =>
      pricing.filter((item) => {
        if (!needle) return true;
        return String(item.sku ?? "").toLowerCase().includes(needle);
      }),
    [needle, pricing],
  );
  const filteredBooks = useMemo(
    () =>
      priceBooks.filter((book) => {
        if (!needle) return true;
        return `${book.title} ${book.description ?? ""}`.toLowerCase().includes(needle);
      }),
    [needle, priceBooks],
  );

  if (pricingQuery.isLoading || contentQuery.isLoading) {
    return <LoadingState />;
  }

  if (pricingQuery.error) {
    return <ErrorState message={`Unable to load pricing: ${errorMessage(pricingQuery.error)}`} />;
  }

  const hasResults = filteredPricing.length > 0 || filteredBooks.length > 0;
  return (
    <div className="w-full max-w-6xl space-y-8 p-6 md:mx-auto md:p-10">
      <header className="flex flex-col justify-between gap-4 border-b border-[#121210]/10 pb-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-[#121210]">
            <FileSpreadsheet className="h-8 w-8 text-[#B39862]" />
            Wholesale Pricing
          </h1>
          <p className="text-[#121210]/60">
            Current pricebook and custom rates for your dealership.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/40" />
          <Input
            placeholder="Search by SKU or pricebook…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-none border-[#121210]/20 bg-white pl-9 text-[#121210] placeholder:text-[#121210]/40 focus-visible:ring-[#B39862]"
          />
        </div>
      </header>

      {contentQuery.error && (
        <div className="flex items-start gap-3 border border-[#B39862]/40 bg-[#B39862]/10 p-4 text-sm text-[#121210]/75">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8b382b]" />
          <p>
            Some published pricebook content could not be loaded. Your current
            rates remain available. {errorMessage(contentQuery.error)}
          </p>
        </div>
      )}

      {filteredBooks.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B39862]">
              Published pricebooks
            </p>
            <h2 className="mt-1 text-xl font-light text-[#121210]">
              Dealer resources
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredBooks.map((book) => {
              const url = contentUrl(book);
              return (
                <div
                  key={book.id}
                  className="flex flex-col justify-between border border-[#121210]/10 bg-white p-5 transition-colors hover:border-[#B39862]/50"
                >
                  <div>
                    <h3 className="font-medium text-[#121210]">{book.title}</h3>
                    {book.description && (
                      <p className="mt-2 text-sm text-[#121210]/60">
                        {book.description}
                      </p>
                    )}
                  </div>
                  {url?.startsWith("http") && (
                    <div className="mt-5 border-t border-[#121210]/10 pt-4">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm font-medium text-[#806936] transition-colors hover:text-[#121210] hover:underline"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Open pricebook
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {filteredPricing.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B39862]">
              Your rates
            </p>
            <h2 className="mt-1 text-xl font-light text-[#121210]">
              Custom wholesale pricing
            </h2>
          </div>
          <div className="overflow-x-auto border border-[#121210]/10 bg-white">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-xs uppercase tracking-widest text-[#121210]/55">
                <tr>
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Wholesale Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121210]/10">
                {filteredPricing.map((item, index) => {
                  const sku = String(item.sku ?? "");
                  const amount = item.wholesaleAmount;
                  const currency = String(item.currency || "USD");
                  let formattedAmount: string | null = null;
                  if (amount !== null && amount !== undefined && amount !== "") {
                    try {
                      formattedAmount = new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(Number(amount));
                    } catch {
                      formattedAmount = `${amount} ${currency}`;
                    }
                  }
                  return (
                    <tr key={`${sku}-${index}`} className="transition-colors hover:bg-[#B39862]/[0.06]">
                      <td className="px-6 py-4 font-mono font-medium text-[#121210]">{sku}</td>
                      <td className="px-6 py-4 capitalize text-[#121210]/70">
                        {String(item.pricingStatus ?? "—")}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[#121210]">
                        {formattedAmount ? (
                          <span className="font-semibold">{formattedAmount}</span>
                        ) : (
                          <span className="italic text-[#121210]/45">TBD</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        !filteredBooks.length &&
        !hasResults && (
          <div className="border border-[#121210]/10 bg-white p-12 text-center text-[#121210]/50">
            {needle ? "No pricing information matches your search." : "No pricing information available."}
          </div>
        )
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#B39862]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto flex max-w-2xl items-start gap-3 border border-[#8b382b]/30 bg-[#8b382b]/5 p-5 text-[#8b382b]">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-medium">Pricing is unavailable</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}