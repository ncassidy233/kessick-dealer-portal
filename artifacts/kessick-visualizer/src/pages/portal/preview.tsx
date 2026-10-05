import { useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  Layers3,
  Menu,
  ShieldCheck,
  UserRound,
  Wine,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

type PreviewSection =
  | "Dashboard"
  | "Projects"
  | "Collections"
  | "Training"
  | "Pricing"
  | "Resources"
  | "Forms"
  | "Notices"
  | "Account";

const navigation: { label: PreviewSection; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home },
  { label: "Projects", icon: BriefcaseBusiness },
  { label: "Collections", icon: Layers3 },
  { label: "Training", icon: GraduationCap },
  { label: "Pricing", icon: CircleDollarSign },
  { label: "Resources", icon: FolderOpen },
  { label: "Forms", icon: FileText },
  { label: "Notices", icon: Bell },
  { label: "Account", icon: UserRound },
];

const products = [
  {
    name: "Estate",
    description: "A refined foundation for custom wine cellar design.",
    href: "https://kessickwinecellars.com/estate/",
  },
  {
    name: "Elevation",
    description: "Contemporary wine displays designed to make a statement.",
    href: "https://kessickwinecellars.com/elevation/",
  },
  {
    name: "Wine As Art",
    description: "A sculptural approach to presenting a wine collection.",
    href: "https://kessickwinecellars.com/wine-as-art/",
  },
  {
    name: "Explore Kessick styles",
    description: "Browse the broader range of Kessick wine storage styles.",
    href: "https://kessickwinecellars.com/our-styles/",
  },
];

const sampleProjects = [
  { name: "Sample hillside residence", type: "Estate · Private residence", status: "Design review" },
  { name: "Example tasting room", type: "Elevation · Hospitality", status: "Quote requested" },
  { name: "Demo renovation project", type: "Wine As Art · Remodel", status: "In progress" },
];

const sampleResources = [
  { title: "Product catalogs", category: "Product information" },
  { title: "Planning and specification references", category: "Design resources" },
  { title: "Installation and care guidance", category: "Project support" },
  { title: "Kessick design process", category: "Getting started" },
];

function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#b39862]/40 bg-[#b39862]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#765d2d]">
      <CheckCircle2 className="h-3 w-3" /> Sample
    </span>
  );
}

function WebsiteLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-[#806936] underline-offset-4 hover:text-[#121210] hover:underline"
    >
      {children} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[#121210]/10 pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b7b3d]">Dealer workspace · sample preview</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight text-[#1b1b19]">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#121210]/60">{description}</p>
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (section: PreviewSection) => void }) {
  return (
    <div className="space-y-7">
      <PageHeading
        title="Welcome to your dealer workspace"
        description="A sample view of the Kessick dealer experience: explore collections, follow example projects, and find product and planning resources."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active projects", "03"],
          ["Open requests", "01"],
          ["Resource categories", "04"],
          ["Unread notices", "02"],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#121210]/10 bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-[#121210]/60">{label}</p>
              <SampleBadge />
            </div>
            <p className="mt-4 text-3xl font-light text-[#1b1b19]">{value}</p>
          </div>
        ))}
      </div>
      <section className="border border-[#121210]/10 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-medium">Recent projects</h2><SampleBadge /></div>
            <p className="mt-1 text-sm text-[#121210]/55">Fictional examples of project tracking in the portal.</p>
          </div>
          <button onClick={() => onNavigate("Projects")} className="inline-flex items-center gap-2 text-sm font-medium text-[#806936] hover:underline">
            View sample projects <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 divide-y divide-[#121210]/10">
          {sampleProjects.slice(0, 2).map((project) => (
            <div key={project.name} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><p className="font-medium">{project.name}</p><p className="mt-1 text-xs text-[#121210]/55">{project.type}</p></div>
              <span className="border border-[#121210]/10 px-2.5 py-1 text-xs text-[#121210]/65">{project.status}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Product collections", text: "Explore Kessick product families and finishes.", section: "Collections" as const, icon: Wine },
          { title: "Dealer resources", text: "Find product and project-planning references.", section: "Resources" as const, icon: FolderOpen },
          { title: "Training & process", text: "See how product and project guidance is organized.", section: "Training" as const, icon: BookOpen },
        ].map(({ title, text, section, icon: Icon }) => (
          <button key={title} onClick={() => onNavigate(section)} className="border border-[#121210]/10 bg-white p-5 text-left transition-colors hover:border-[#b39862]/70">
            <Icon className="h-5 w-5 text-[#9b7b3d]" />
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-1 text-sm text-[#121210]/55">{text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionContent({ section, onNavigate }: { section: PreviewSection; onNavigate: (section: PreviewSection) => void }) {
  if (section === "Dashboard") return <Dashboard onNavigate={onNavigate} />;

  if (section === "Collections") {
    return (
      <div className="space-y-6">
        <PageHeading title="Collections & finishes" description="An at-a-glance sample of product discovery in the dealer portal. Product descriptions are brief summaries; visit Kessick for current product details." />
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <article key={product.name} className="flex min-h-48 flex-col justify-between border border-[#121210]/10 bg-white p-6">
              <div><SampleBadge /><h2 className="mt-4 text-xl font-medium">{product.name}</h2><p className="mt-2 text-sm leading-relaxed text-[#121210]/60">{product.description}</p></div>
              <div className="mt-5"><WebsiteLink href={product.href}>View on Kessick website</WebsiteLink></div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Projects") {
    return (
      <div className="space-y-6">
        <PageHeading title="Projects" description="Example project cards show how a dealer could review project type and status. These are fictional and are not connected to a customer or live project." />
        <div className="grid gap-4 lg:grid-cols-2">
          {sampleProjects.map((project) => (
            <article key={project.name} className="border border-[#121210]/10 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><SampleBadge /><h2 className="mt-3 text-lg font-medium">{project.name}</h2></div><span className="border border-[#121210]/10 px-2.5 py-1 text-xs">{project.status}</span></div>
              <p className="mt-3 text-sm text-[#121210]/60">{project.type}</p>
              <p className="mt-5 border-t border-[#121210]/10 pt-4 text-xs text-[#121210]/45">Example only · No proposal or customer details are available in this preview.</p>
            </article>
          ))}
        </div>
        <div className="border border-dashed border-[#121210]/20 bg-white/60 p-5 text-sm text-[#121210]/60">Project creation and proposal actions are disabled in this public sample preview.</div>
      </div>
    );
  }

  if (section === "Pricing") {
    return (
      <div className="space-y-6">
        <PageHeading title="Wholesale pricing" description="A sample of where dealer pricebooks would appear. Real wholesale pricing is account-specific and is intentionally not displayed in a public preview." />
        <section className="border border-[#b39862]/40 bg-[#b39862]/10 p-5 sm:p-7">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#806936]" /><div><h2 className="font-medium">Dealer-specific pricing stays private</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#121210]/65">This sample includes no real rates, SKUs, discounts, or pricebook files. Approved dealer accounts would see only the pricing assigned to them after signing in.</p></div></div>
        </section>
        <div className="border border-[#121210]/10 bg-white p-6">
          <SampleBadge /><h3 className="mt-4 font-medium">Example pricebook area</h3><p className="mt-2 text-sm text-[#121210]/55">A private dealer view could list current catalogs and account pricing here. No prices are shown in this preview.</p>
        </div>
      </div>
    );
  }

  if (section === "Resources") {
    return (
      <div className="space-y-6">
        <PageHeading title="Resource library" description="Sample resource categories illustrate the types of materials a dealer may look for. Check Kessick’s public resource page for the current published materials." />
        <div className="grid gap-4 sm:grid-cols-2">
          {sampleResources.map((resource) => (
            <article key={resource.title} className="border border-[#121210]/10 bg-white p-5">
              <div className="flex items-start justify-between gap-2"><span className="text-xs uppercase tracking-wider text-[#806936]">{resource.category}</span><SampleBadge /></div>
              <h2 className="mt-4 font-medium">{resource.title}</h2>
              <p className="mt-2 text-sm text-[#121210]/55">Sample category · Not a downloadable file</p>
            </article>
          ))}
        </div>
        <WebsiteLink href="https://kessickwinecellars.com/resources/">Browse Kessick resources</WebsiteLink>
      </div>
    );
  }

  if (section === "Training") {
    return (
      <div className="space-y-6">
        <PageHeading title="Training & onboarding" description="A sample training landing page for product orientation and design-process guidance. This preview does not contain private dealer courses." />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Product orientation", "Introductory overview of Kessick product families.", "https://kessickwinecellars.com/our-styles/"],
            ["Design process", "Learn about the path from project concept to custom wine cellar.", "https://kessickwinecellars.com/process/"],
          ].map(([title, description, href]) => (
            <article key={title} className="border border-[#121210]/10 bg-white p-6">
              <div className="flex items-center justify-between gap-2"><GraduationCap className="h-5 w-5 text-[#9b7b3d]" /><SampleBadge /></div>
              <h2 className="mt-5 text-lg font-medium">{title}</h2><p className="mt-2 text-sm text-[#121210]/60">{description}</p>
              <div className="mt-5"><WebsiteLink href={href}>Read public guidance</WebsiteLink></div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Forms") {
    return (
      <div className="space-y-6">
        <PageHeading title="Dealer forms" description="A sample index of common dealer requests. Form submission is disabled here; use your authorized dealer account for real requests." />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Project quote request", "Share project basics for a Kessick review."],
            ["Product information", "Ask about a product family or finish."],
            ["Dealer support", "Request help with an active project."],
          ].map(([title, description]) => (
            <article key={title} className="border border-[#121210]/10 bg-white p-5">
              <SampleBadge /><h2 className="mt-4 font-medium">{title}</h2><p className="mt-2 min-h-10 text-sm text-[#121210]/55">{description}</p>
              <button disabled className="mt-5 cursor-not-allowed border border-[#121210]/15 px-3 py-2 text-xs text-[#121210]/45">Sample form · unavailable</button>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Notices") {
    return (
      <div className="space-y-6">
        <PageHeading title="Notices & updates" description="Fictional examples of announcements that could appear in a dealer portal. They are not active Kessick notices." />
        {[
          ["Sample product update", "Example announcement about a product collection.", "Sample · Today"],
          ["Demo resource reminder", "Example reminder to review current product resources.", "Sample · Earlier"],
        ].map(([title, body, date]) => (
          <article key={title} className="border border-[#121210]/10 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{title}</h2><SampleBadge /></div><p className="mt-2 text-sm text-[#121210]/60">{body}</p><p className="mt-4 text-xs text-[#121210]/40">{date} · Fictional</p></article>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Dealer account" description="A fictional account card to illustrate the dealer profile view. No real person, company, or email address is represented." />
      <section className="max-w-2xl border border-[#121210]/10 bg-white p-6">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center bg-[#b39862]/10 text-[#806936]"><UserRound className="h-5 w-5" /></div><div><h2 className="font-medium">Sample Dealer</h2><p className="text-sm text-[#121210]/55">Example Cellars LLC · demo@example.test</p></div><div className="ml-auto"><SampleBadge /></div></div>
        <div className="mt-6 grid gap-4 border-t border-[#121210]/10 pt-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider text-[#121210]/45">Account status</p><p className="mt-1 text-sm">Sample approved dealer</p></div><div><p className="text-xs uppercase tracking-wider text-[#121210]/45">Account access</p><p className="mt-1 text-sm">Illustrative only · no sign-in</p></div></div>
      </section>
    </div>
  );
}

export default function DealerPortalPreview() {
  const [section, setSection] = useState<PreviewSection>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (next: PreviewSection) => {
    setSection(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f4f2ed] text-[#1b1b19]">
      <div role="alert" className="sticky top-0 z-50 flex min-h-11 items-center justify-center gap-2 bg-[#8d3b2b] px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white sm:text-xs">
        <span aria-hidden="true">⚠</span> SAMPLE DEALER PREVIEW · FICTIONAL DATA · NO SIGN-IN OR LIVE ACTIONS
      </div>
      <header className="flex min-h-16 items-center justify-between border-b border-black/10 bg-white px-4 sm:px-6">
        <BrandLogo tone="dark" className="h-5 w-auto" />
        <a href="https://kessickwinecellars.com/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#806936] sm:inline-flex">
          Kessick website <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button aria-label="Toggle dealer preview navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="inline-flex items-center gap-2 border border-black/10 px-3 py-2 text-sm md:hidden">
          <Menu className="h-4 w-4" /> Sections
        </button>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-6.25rem)] max-w-[1600px]">
        <aside className={`${menuOpen ? "block" : "hidden"} absolute z-20 w-64 border-r border-black/10 bg-white md:static md:block md:shrink-0`}>
          <div className="border-b border-black/10 px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7b3d]">Dealer portal</p>
            <p className="mt-1 text-sm font-medium">Sample workspace</p>
          </div>
          <nav aria-label="Sample dealer portal sections" className="space-y-1 p-3">
            {navigation.map(({ label, icon: Icon }) => (
              <button key={label} aria-current={section === label ? "page" : undefined} onClick={() => navigate(label)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${section === label ? "bg-[#171715] font-medium text-white" : "text-black/60 hover:bg-black/5 hover:text-black"}`}>
                <Icon className="h-4 w-4 shrink-0" />{label}
              </button>
            ))}
          </nav>
          <div className="m-4 border border-[#b39862]/30 bg-[#b39862]/10 p-3 text-xs leading-relaxed text-[#725a2c]">
            Every account, project, status, notice, and count in this preview is fictional. No dealer data or live portal actions are connected.
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white px-5 py-4 sm:px-8">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b7b3d]">Authorized dealership network</p><p className="mt-1 text-sm font-medium">Dealer preview</p></div>
            <div className="flex items-center gap-2 border border-[#b39862]/30 bg-[#b39862]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#725a2c]"><ShieldCheck className="h-4 w-4" /> SAMPLE ACCOUNT</div>
          </div>
          <div className="mx-auto max-w-6xl space-y-7 p-5 sm:p-8">
            <SectionContent section={section} onNavigate={navigate} />
            <footer className="border-t border-black/10 pt-5 text-xs leading-relaxed text-[#121210]/50">
              Public preview only. It does not grant access to dealer accounts or private pricing. Product links open Kessick Wine Cellars’ public website.
              <span className="ml-2"><WebsiteLink href="https://kessickwinecellars.com/">Visit Kessick Wine Cellars</WebsiteLink></span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
