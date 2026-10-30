import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { customFetch, dealerPreviewLinkUrl } from "@workspace/api-client-react";
import { Link, Route, Router, Switch } from "wouter";
import { DealerPreviewContext, staffHome, usePortalSession } from "@/lib/portal-session";
import { dealerAccessState } from "@/lib/dealer-access";
import { PortalLayout } from "@/components/layouts/portal-layout";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalProjects from "@/pages/portal/projects";
import PortalCollections from "@/pages/portal/collections";
import PortalTraining from "@/pages/portal/training";
import PortalPricing from "@/pages/portal/pricing";
import PortalResources from "@/pages/portal/resources";
import PortalForms from "@/pages/portal/forms";
import PortalNotifications from "@/pages/portal/notifications";
import PortalAccount from "@/pages/portal/account";

export default function DealerView({ dealerId }: { dealerId?: string }) {
  const { data: staff } = usePortalSession();
  const dealers = useQuery({
    queryKey: ["staff-dealer-preview-accounts"],
    queryFn: () => customFetch<{ dealers: { id: string; displayName: string | null; email: string }[] }>("/api/staff/dealer-view", { responseType: "json" }),
    retry: false,
  });
  return <div className="min-h-screen bg-[#111110] text-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B39862]/40 bg-[#111110] p-4">
      <div><h1 className="font-semibold">Dealer View — published content</h1><p className="text-xs text-white/70">Read-only. You remain signed in as staff. Dealer actions are disabled.</p></div>
      <Link href={staffHome(staff?.role)} className="inline-flex min-h-11 items-center border border-[#B39862] px-4 text-sm font-semibold">Back to Administration</Link>
      <label className="flex w-full flex-wrap items-center gap-2 text-sm">View as dealer
        <select aria-label="View as dealer" value={dealerId ?? ""} className="min-h-11 max-w-full border border-white/30 bg-[#111110] p-2" onChange={event => {
          const nextDealerId = event.currentTarget.value;
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(nextDealerId)) {
            window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin/dealer-view/${encodeURIComponent(nextDealerId)}/portal`);
          }
        }}>
          <option value="">Select an approved dealer</option>
          {dealers.data?.dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.displayName || dealer.email}</option>)}
        </select>
      </label>
    </header>
    {dealers.isError ? <div role="alert" className="p-6">Dealer View could not be authorized or loaded. <button className="underline" onClick={() => dealers.refetch()}>Retry</button></div>
      : dealers.isPending ? <p className="p-6" role="status">Loading approved dealers…</p>
      : dealerId ? <SelectedDealer key={dealerId} dealerId={dealerId} />
      : <p className="p-6">{dealers.data.dealers.length ? "Select an approved dealer to view their actual portal." : "No approved dealer organizations are available to preview."}</p>}
  </div>;
}

function SelectedDealer({ dealerId }: { dealerId: string }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><DealerPreviewContext.Provider value={dealerId}>
    <Router base={`/admin/dealer-view/${dealerId}`}>
      <DealerPages />
    </Router>
  </DealerPreviewContext.Provider></QueryClientProvider>;
}

function DealerPages() {
  const session = usePortalSession();
  if (dealerAccessState(session) !== "allowed") {
    return <div className="p-6" role={session.isLoading ? "status" : "alert"}>{session.isLoading ? "Checking dealer permissions…" : "This dealer preview is unavailable. Access remains locked."}<button className="ml-3 underline" onClick={() => session.refetch()}>Retry</button></div>;
  }
  return <><div className="px-4 pb-3 text-xs"><button className="min-h-8 underline" onClick={() => session.refetch()}>Refresh dealer permissions</button></div><div onClickCapture={event => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const href = dealerPreviewLinkUrl(anchor.href, new URL(window.location.href), import.meta.env.BASE_URL);
    if (!href) { event.preventDefault(); event.stopPropagation(); return; }
    if (href !== anchor.href) {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(href);
    }
  }}><PortalLayout><Switch>
    <Route path="/portal" component={PortalDashboard} />
    <Route path="/portal/projects" component={PortalProjects} />
    <Route path="/portal/collections" component={PortalCollections} />
    <Route path="/portal/training" component={PortalTraining} />
    <Route path="/portal/pricing" component={PortalPricing} />
    <Route path="/portal/resources" component={PortalResources} />
    <Route path="/portal/forms"><fieldset disabled className="min-w-0"><PortalForms /></fieldset></Route>
    <Route path="/portal/notifications"><fieldset disabled className="min-w-0"><PortalNotifications /></fieldset></Route>
    <Route path="/portal/account"><fieldset disabled className="min-w-0"><PortalAccount /></fieldset></Route>
    <Route><p className="p-6">This page is not available in Dealer View.</p></Route>
  </Switch></PortalLayout></div></>;
}
