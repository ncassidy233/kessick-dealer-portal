import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { staffHome, usePortalSession } from "@/lib/portal-session";
import { StaffDealerViewContext } from "@/lib/staff-dealer-view-context";
import { dealerAccessState } from "@/lib/dealer-access";
import { PortalLayout } from "@/components/layouts/portal-layout";
import DealerPortalPreview from "@/pages/portal/preview";
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
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const dealers = useQuery({
    queryKey: ["staff-dealer-preview-accounts"],
    queryFn: ({ signal }) => customFetch<{ dealers: { id: string; displayName: string | null; email: string }[] }>("/api/staff/dealer-view", { responseType: "json", signal }),
    retry: false,
  });
  const available = dealers.data?.dealers.filter(dealer => dealer.id === dealerId || `${dealer.displayName ?? ""} ${dealer.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="min-h-screen bg-[#111110] text-white">
    <header className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-b border-[#B39862]/40 bg-[#111110] p-4">
      <div><h1 className="font-semibold">Dealer View — published content</h1><p className="text-sm font-semibold text-[#d8c18d]">Staff View — Read Only</p><p className="text-xs text-white/70">You remain signed in as staff. Dealer actions are disabled.</p></div>
      <Link href={staffHome(staff?.role)} className="inline-flex min-h-11 items-center border border-[#B39862] px-4 text-sm font-semibold">Back to Administration</Link>
      <div className="flex w-full flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm">Search dealers
          <input type="search" aria-label="Search dealers" value={search} onChange={event => setSearch(event.currentTarget.value)} className="min-h-11 max-w-full border border-white/30 bg-[#111110] p-2" placeholder="Name or email" />
        </label>
        <label className="flex max-w-full flex-wrap items-center gap-2 text-sm">View as dealer
          <select aria-label="View as dealer" value={dealerId ?? ""} className="min-h-11 max-w-full border border-white/30 bg-[#111110] p-2" onChange={event => {
            const id = event.currentTarget.value;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) && dealers.data?.dealers.some(dealer => dealer.id === id)) navigate(`/admin/dealer-view/${id}/portal`);
          }}>
            <option value="">Select an approved dealer</option>
            {available?.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.displayName || dealer.email}</option>)}
          </select>
        </label>
      </div>
    </header>
    {dealers.isError ? <div role="alert" className="p-6">Dealer View could not be authorized or loaded. <button className="underline" onClick={() => dealers.refetch()}>Retry</button></div>
      : dealers.isPending ? <p className="p-6" role="status">Loading approved dealers…</p>
      : dealerId ? <StaffDealerViewContext.Provider key={dealerId} value={{ selectedDealerAccountId: dealerId, readOnly: true }}>
          <DealerPortalPreview staffInline={<DealerPages dealerId={dealerId} />} />
        </StaffDealerViewContext.Provider>
      : <p className="p-6">{dealers.data.dealers.length ? "Select an approved dealer to view their actual portal." : "No approved dealer organizations are available to preview."}</p>}
  </div>;
}

const pages = {
  "": PortalDashboard, projects: PortalProjects, collections: PortalCollections,
  training: PortalTraining, pricing: PortalPricing, resources: PortalResources,
  forms: PortalForms, notifications: PortalNotifications, account: PortalAccount,
};

function DealerPages({ dealerId }: { dealerId: string }) {
  const [location] = useLocation();
  const session = usePortalSession();
  if (dealerAccessState(session) !== "allowed") {
    return <div className="p-6" role={session.isLoading ? "status" : "alert"}>{session.isLoading ? "Checking dealer permissions…" : "This dealer preview is unavailable. Access remains locked."}<button className="ml-3 underline" onClick={() => session.refetch()}>Retry</button></div>;
  }
  const prefix = `/admin/dealer-view/${dealerId}/portal`;
  const section = location === prefix || location === `${prefix}/` ? "" : location.startsWith(`${prefix}/`) ? location.slice(prefix.length + 1) : null;
  const Page = section !== null ? pages[section as keyof typeof pages] : undefined;
  const content = Page ? <Page /> : <p className="p-6">This page is not available in Dealer View.</p>;
  return <><div className="px-4 pb-3 text-xs"><button className="min-h-8 underline" onClick={() => session.refetch()}>Refresh dealer permissions</button></div>
    <PortalLayout signOutControl={null}>{content}</PortalLayout>
  </>;
}
