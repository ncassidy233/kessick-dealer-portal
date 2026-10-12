import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Boxes,
  FileText,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const sampleUsers = [
  { name: "Avery Sample", email: "avery@example.test", company: "Northstar Cellars", status: "Approved", tone: "green" },
  { name: "Morgan Example", email: "morgan@example.test", company: "Demo Design Studio", status: "Pending", tone: "gold" },
  { name: "Taylor Preview", email: "taylor@example.test", company: "Sample Wine Co.", status: "Approved", tone: "green" },
  { name: "Jordan Fiction", email: "jordan@example.test", company: "Example Hospitality", status: "Review", tone: "red" },
];

const sampleActivity = [
  { action: "Sample account approved", detail: "Avery Sample · Northstar Cellars", when: "Today, 10:42 AM", icon: ShieldCheck },
  { action: "Demo collection published", detail: "Spring portfolio · Sample audience", when: "Today, 9:18 AM", icon: BookOpen },
  { action: "Example notice scheduled", detail: "Preview notification · 4 sample recipients", when: "Yesterday", icon: Bell },
];

const metrics = [
  { label: "Dealer accounts", value: "128", detail: "112 approved", change: "+8.2%", icon: Users, up: true },
  { label: "Pending review", value: "7", detail: "Sample queue", change: "2 new", icon: ShieldCheck, up: false },
  { label: "Published content", value: "34", detail: "Across sample audiences", change: "+3", icon: FileText, up: true },
  { label: "Dealer groups", value: "12", detail: "Illustrative groups", change: "+1", icon: Boxes, up: true },
];

export default function AdminPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f4f2ed] text-[#1b1b19]">
      <div role="alert" className="sticky top-0 z-50 flex min-h-12 items-center justify-center gap-2 bg-[#8d3b2b] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white sm:text-sm">
        <span aria-hidden="true">⚠</span>
        SAMPLE DATA — SUPER ADMIN PREVIEW — NO REAL ACCOUNTS OR ACTIONS
      </div>
      <div className="flex min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-black/10 bg-white md:flex">
          <div className="border-b border-black/10 px-6 py-6">
            <BrandLogo tone="dark" className="h-5 w-auto" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7b3d]">Sample staff admin</p>
          </div>
          <nav aria-label="Sample administration navigation" className="flex-1 space-y-1 p-4">
            <div className="flex items-center gap-3 bg-[#171715] px-3 py-2.5 text-sm font-medium text-white"><LayoutDashboard className="h-4 w-4" /> Overview</div>
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-black/55"><Users className="h-4 w-4" /> Accounts <span className="ml-auto text-[10px]">SAMPLE</span></div>
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-black/55"><Boxes className="h-4 w-4" /> Groups</div>
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-black/55"><FileText className="h-4 w-4" /> Content</div>
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-black/55"><Bell className="h-4 w-4" /> Notifications</div>
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-black/55"><Activity className="h-4 w-4" /> Audit log</div>
          </nav>
          <div className="m-4 border border-[#b39862]/30 bg-[#b39862]/10 p-3 text-xs leading-relaxed text-[#725a2c]">
            Demonstration only. Controls are disabled and nothing here changes portal data.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-col gap-3 border-b border-black/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-3 md:hidden"><BrandLogo tone="dark" className="h-5 w-auto" /><span className="text-[10px] font-bold uppercase tracking-wider text-[#8d3b2b]">Sample preview</span></div>
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-black/35" />
              <div aria-label="Sample search, disabled" className="border border-black/10 bg-[#f8f7f4] py-2 pl-9 pr-3 text-sm text-black/35">Search sample admin…</div>
            </div>
            <div className="flex items-center gap-2 self-end border border-[#b39862]/30 bg-[#b39862]/10 px-3 py-2 text-xs font-semibold text-[#725a2c] sm:self-auto">
              <ShieldCheck className="h-4 w-4" /> SAMPLE SUPER ADMIN
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
            <section className="flex flex-col gap-2 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9b7b3d]">Trade desk operations · demo</p>
                <h1 className="mt-1 text-3xl font-medium tracking-tight sm:text-4xl">Staff overview</h1>
                <p className="mt-2 text-sm text-black/55">An illustrative look at Super Admin tools. Every name, number, and event below is fictional sample data.</p>
              </div>
              <span className="w-fit border border-[#8d3b2b]/25 bg-[#8d3b2b]/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#8d3b2b]">Read-only mockup</span>
            </section>

            <section aria-label="Sample metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(({ label, value, detail, change, icon: Icon, up }) => (
                <article key={label} className="border border-black/10 bg-white p-5">
                  <div className="flex items-start justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/50">{label}</p><Icon className="h-4 w-4 text-[#9b7b3d]" /></div>
                  <p className="mt-4 text-4xl font-medium">{value}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-black/50"><span>{detail}</span><span className="flex items-center font-semibold text-[#52704c]">{up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5 text-[#9b7b3d]" />}{change}</span></div>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <article className="overflow-hidden border border-black/10 bg-white">
                <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b7b3d]">Example records</p><h2 className="mt-1 text-lg font-medium">Dealer accounts</h2></div>
                  <span className="border border-[#8d3b2b]/20 bg-[#8d3b2b]/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#8d3b2b]">All sample</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-[#f8f7f4] text-[9px] uppercase tracking-[0.14em] text-black/45"><tr><th className="px-5 py-3">Name / email</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Status</th></tr></thead>
                    <tbody className="divide-y divide-black/[0.07]">
                      {sampleUsers.map((user) => <tr key={user.email}>
                        <td className="px-5 py-4"><div className="font-medium">{user.name}</div><div className="mt-0.5 text-xs text-black/45">{user.email}</div></td>
                        <td className="px-4 py-4 text-xs text-black/60">{user.company}</td>
                        <td className="px-4 py-4"><span className={`inline-flex border px-2 py-1 text-[10px] font-semibold ${user.tone === "green" ? "border-green-800/20 bg-green-800/5 text-green-900" : user.tone === "red" ? "border-red-800/20 bg-red-800/5 text-red-900" : "border-[#9b7b3d]/25 bg-[#9b7b3d]/10 text-[#725a2c]"}`}>{user.status}</span></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="border border-black/10 bg-white">
                <div className="border-b border-black/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b7b3d]">Example events</p><h2 className="mt-1 text-lg font-medium">Recent activity</h2></div>
                <ul className="divide-y divide-black/[0.07]">
                  {sampleActivity.map(({ action, detail, when, icon: Icon }) => <li key={action} className="flex gap-3 px-5 py-4">
                    <span className="mt-0.5 border border-[#b39862]/30 bg-[#b39862]/10 p-2 text-[#725a2c]"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-sm font-medium">{action}</span><span className="mt-1 block text-xs text-black/50">{detail}</span><span className="mt-2 block text-[10px] text-black/35">{when} · SAMPLE</span></span>
                  </li>)}
                </ul>
              </article>
            </section>

            <p className="border-l-2 border-[#8d3b2b] bg-white px-4 py-3 text-xs leading-relaxed text-black/60">
              <strong className="text-[#8d3b2b]">Sample data only.</strong> This preview is disconnected from the live portal. It does not show actual dealer records and has no working account, approval, publishing, or administrative controls.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
