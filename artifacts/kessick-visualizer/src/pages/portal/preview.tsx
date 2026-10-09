import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  Home,
  Layers3,
  Mail,
  MessageSquareText,
  Search,
  ShieldCheck,
  UserRound,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import cellarImage from "@assets/kessick-room-demo.jpg";

type PreviewSection =
  | "Home"
  | "Projects"
  | "Collections"
  | "Training"
  | "Pricing"
  | "Resources"
  | "Forms"
  | "Notices"
  | "Account"
  | "Support";

const navigation: { label: PreviewSection; icon: LucideIcon }[] = [
  { label: "Home", icon: Home },
  { label: "Projects", icon: BriefcaseBusiness },
  { label: "Collections", icon: Layers3 },
  { label: "Training", icon: GraduationCap },
  { label: "Pricing", icon: CircleDollarSign },
  { label: "Resources", icon: FolderOpen },
  { label: "Forms", icon: FileText },
  { label: "Notices", icon: Bell },
  { label: "Account", icon: UserRound },
  { label: "Support", icon: Headphones },
];

const mobileNavigation: { label: PreviewSection; icon: LucideIcon }[] = [
  { label: "Home", icon: Home },
  { label: "Account", icon: UserRound },
  { label: "Notices", icon: Bell },
  { label: "Support", icon: Headphones },
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
    name: "Forma",
    description: "Explore Kessick's Forma wine storage collection.",
    href: "https://kessickwinecellars.com/our-styles/",
  },
  {
    name: "Towers",
    description: "Explore Kessick styles and discuss a tower design.",
    href: "https://kessickwinecellars.com/our-styles/",
  },
];

const sampleProjects = [
  {
    name: "Hillside Residence",
    type: "Estate · Private residence",
    status: "Design review",
  },
  {
    name: "The Tasting Room",
    type: "Elevation · Hospitality",
    status: "Quote requested",
  },
  {
    name: "Garden District Remodel",
    type: "Wine As Art · Renovation",
    status: "In progress",
  },
];

const sampleResources = [
  {
    title: "Renderings & inspiration",
    category: "Design resources",
    icon: Layers3,
  },
  {
    title: "Policies & project guides",
    category: "Dealer guidance",
    icon: BookOpen,
  },
  {
    title: "Installation & spec sheets",
    category: "Project support",
    icon: FileText,
  },
  { title: "Wood stain chart", category: "Finishes", icon: Wine },
  {
    title: "Catalogs & brochures",
    category: "Product information",
    icon: FolderOpen,
  },
  {
    title: "Logos & marketing",
    category: "Brand resources",
    icon: ExternalLink,
  },
];

const sampleAnnouncements = [
  {
    title: "New collection preview",
    category: "New products",
    body: "A sample announcement showing where new Kessick collections and product updates will appear.",
  },
  {
    title: "A new look at custom cellars",
    category: "Coming soon",
    body: "Example preview content only. No release date, availability, or offer is being announced.",
  },
  {
    title: "Dealer policy update",
    category: "Policies",
    body: "A sample policy notice. Refer to your authorized account for current dealer policies.",
  },
];

type SearchResult = { title: string; detail: string; section: PreviewSection };

function SampleBadge({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
        light
          ? "border-white/20 bg-black/25 text-white/85"
          : "border-[#ad9561]/35 bg-[#ad9561]/10 text-[#78643b]"
      }`}
    >
      <CheckCircle2 className="h-3 w-3" /> Sample
    </span>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#947d4d]">
      {children}
    </p>
  );
}

function WebsiteLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-semibold text-[#705a31] underline-offset-4 hover:text-[#171715] hover:underline"
    >
      {children} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7 border-b border-[#171715]/10 pb-5">
      <SectionEyebrow>Dealer workspace · sample preview</SectionEyebrow>
      <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-[#171715] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#171715]/60">
        {description}
      </p>
    </div>
  );
}

function PreviewDashboard({
  onNavigate,
  onSearch,
  search,
  results,
}: {
  onNavigate: (section: PreviewSection) => void;
  onSearch: (value: string) => void;
  search: string;
  results: SearchResult[];
}) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-[#171715]/10 bg-white p-5 shadow-[0_18px_50px_rgba(23,23,21,.05)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionEyebrow>Workspace overview</SectionEyebrow>
              <h2 className="mt-2 font-serif text-2xl font-medium text-[#171715] sm:text-3xl">
                Welcome back, Alex.
              </h2>
              <p className="mt-2 text-sm text-[#171715]/55">
                A considered space for your projects, inspiration, and dealer
                support.
              </p>
            </div>
            <SampleBadge />
          </div>
          <label htmlFor="preview-search" className="sr-only">
            Search projects, products, resources, and notices
          </label>
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#171715]/12 bg-[#f8f7f3] px-4 focus-within:border-[#ad9561]">
            <Search className="h-4 w-4 shrink-0 text-[#947d4d]" />
            <input
              id="preview-search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search projects, products, resources…"
              className="h-12 w-full bg-transparent text-sm text-[#171715] outline-none placeholder:text-[#171715]/40"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="text-xs text-[#171715]/50 hover:text-[#171715]"
              >
                Clear
              </button>
            )}
          </div>
          {search.trim() && (
            <div className="mt-2 overflow-hidden rounded-xl border border-[#171715]/10 bg-white">
              {results.length ? (
                results.map((result) => (
                  <button
                    key={`${result.section}-${result.title}`}
                    onClick={() => onNavigate(result.section)}
                    className="flex w-full items-center justify-between gap-4 border-b border-[#171715]/5 px-4 py-3 text-left last:border-0 hover:bg-[#f8f7f3]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {result.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#171715]/50">
                        {result.detail}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#947d4d]" />
                  </button>
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-[#171715]/55">
                  No sample content matches that search.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="relative isolate flex min-h-[210px] items-end overflow-hidden rounded-2xl bg-[#171715] p-5 sm:min-h-[250px] sm:p-7">
          <img
            src={cellarImage}
            alt="Kessick custom wine cellar"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
          <div className="flex w-full items-end justify-between gap-4">
            <div className="text-white">
              <SampleBadge light />
              <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#ddc991]">
                Crafted for your vision
              </p>
              <h2 className="mt-1 font-serif text-2xl">
                Spaces worth savoring.
              </h2>
            </div>
            <button
              onClick={() => onNavigate("Collections")}
              aria-label="Explore collections"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/20 text-white transition hover:bg-white/15"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="toolkit-title">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <SectionEyebrow>At your service</SectionEyebrow>
            <h2
              id="toolkit-title"
              className="mt-1 text-xl font-semibold text-[#171715] sm:text-2xl"
            >
              Your Dealer Toolkit
            </h2>
          </div>
          <span className="hidden text-xs text-[#171715]/45 sm:inline">
            Preview links navigate sample content
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <ToolkitShortcut
            label="What’s New"
            icon={Bell}
            onClick={() => onNavigate("Notices")}
          />
          <ToolkitShortcut
            label="Design Request"
            icon={FileText}
            onClick={() => onNavigate("Forms")}
          />
          <ToolkitShortcut
            label="Dealer Resources"
            icon={FolderOpen}
            onClick={() => onNavigate("Resources")}
          />
          <ToolkitShortcut
            label="Feedback"
            icon={MessageSquareText}
            onClick={() => onNavigate("Support")}
          />
        </div>
      </section>

      <section
        aria-label="Special announcement"
        className="relative isolate overflow-hidden rounded-2xl bg-[#cfb875] text-[#171715]"
      >
        <img
          src={cellarImage}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#dfc983]/95 via-[#dfc983]/85 to-[#dfc983]/45" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <SectionEyebrow>Special announcement</SectionEyebrow>
              <SampleBadge />
            </div>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              A note from the Kessick team
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#171715]/70">
              Sample announcement content only. This preview does not publish
              current offers, policy changes, or product release dates.
            </p>
          </div>
          <button
            onClick={() => onNavigate("Notices")}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#171715] px-5 text-xs font-semibold text-white hover:bg-black sm:self-center"
          >
            View sample notices <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-[#171715]/10 bg-white p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <SectionEyebrow>Your workspace</SectionEyebrow>
              <h2 className="mt-1 text-xl font-semibold">Active projects</h2>
            </div>
            <button
              onClick={() => onNavigate("Projects")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#705a31] hover:underline"
            >
              View sample projects <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 divide-y divide-[#171715]/10">
            {sampleProjects.slice(0, 2).map((project) => (
              <button
                key={project.name}
                onClick={() => onNavigate("Projects")}
                className="flex w-full items-center gap-3 py-4 text-left hover:bg-[#f8f7f3]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
                  <BriefcaseBusiness className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {project.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#171715]/50">
                    {project.type}
                  </span>
                </span>
                <span className="hidden rounded-full bg-[#f4f1e9] px-2.5 py-1 text-[10px] text-[#171715]/60 sm:block">
                  {project.status}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#171715]/35" />
              </button>
            ))}
          </div>
          <p className="border-t border-[#171715]/10 pt-3 text-[10px] leading-relaxed text-[#171715]/45">
            All project names and statuses shown are fictional sample data.
          </p>
        </div>
        <div className="rounded-2xl border border-[#171715]/10 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionEyebrow>Stay in the know</SectionEyebrow>
              <h2 className="mt-1 text-xl font-semibold">Notices & updates</h2>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
              <Bell className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-xs text-[#171715]/50">
            Fictional examples · no active notices
          </p>
          <div className="mt-4 space-y-3">
            {sampleAnnouncements.slice(0, 2).map((notice) => (
              <button
                key={notice.title}
                onClick={() => onNavigate("Notices")}
                className="block w-full border-l-2 border-[#ad9561] py-1 pl-3 text-left"
              >
                <span className="block text-xs font-semibold">
                  {notice.title}
                </span>
                <span className="mt-1 block text-[10px] text-[#171715]/45">
                  {notice.category} · Sample
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate("Notices")}
            className="mt-4 flex w-full items-center justify-between border-t border-[#171715]/10 pt-3 text-xs font-semibold text-[#705a31] hover:text-[#171715]"
          >
            Browse sample updates <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#171715]/10 bg-white">
        <div className="grid md:grid-cols-[1.05fr_.95fr]">
          <div className="relative min-h-[220px] md:min-h-[290px]">
            <img
              src={cellarImage}
              alt="Wine bottles displayed in a custom Kessick cellar"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent md:bg-gradient-to-r md:from-transparent md:to-white/35" />
            <span className="absolute bottom-4 left-4">
              <SampleBadge light />
            </span>
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-8">
            <SectionEyebrow>Featured collection · sample</SectionEyebrow>
            <h2 className="mt-2 font-serif text-2xl font-medium sm:text-3xl">
              Discover the Kessick collection.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#171715]/55">
              Explore Kessick's public product styles. Featured collection
              content in this preview is illustrative and does not indicate
              availability.
            </p>
            <button
              onClick={() => onNavigate("Collections")}
              className="mt-5 inline-flex items-center gap-2 self-start text-xs font-semibold text-[#705a31] hover:text-[#171715]"
            >
              Explore public collections <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolkitShortcut({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-w-0 flex-col items-center gap-2 text-center"
    >
      <span className="flex h-[clamp(3.75rem,16vw,5.5rem)] w-[clamp(3.75rem,16vw,5.5rem)] items-center justify-center rounded-full border border-[#ad9561]/40 bg-white text-[#806936] shadow-[0_8px_24px_rgba(23,23,21,.06)] transition group-hover:-translate-y-0.5 group-hover:border-[#ad9561] group-hover:bg-[#f6f2e7] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#947d4d]">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="max-w-[6.5rem] text-[9px] font-semibold leading-tight text-[#171715]/70 sm:text-xs">
        {label}
      </span>
    </button>
  );
}

function SectionContent({
  section,
  onNavigate,
}: {
  section: PreviewSection;
  onNavigate: (section: PreviewSection) => void;
}) {
  if (section === "Home") return null;

  if (section === "Collections") {
    return (
      <div>
        <PageHeading
          title="Collections & finishes"
          description="Explore a sample of product discovery in the dealer portal. Product summaries are brief; visit Kessick for current details."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product, index) => (
            <article
              key={product.name}
              className="group overflow-hidden rounded-xl border border-[#171715]/10 bg-white"
            >
              <div className="relative h-36 overflow-hidden">
                <img
                  src={cellarImage}
                  alt={`${product.name} wine storage style`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-3 left-3">
                  <SampleBadge light />
                </span>
              </div>
              <div className="p-5">
                <p className="text-[9px] uppercase tracking-[0.16em] text-[#947d4d]">
                  {index === 3 || index === 4
                    ? "Style inquiry"
                    : "Kessick collection"}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
                <p className="mt-2 min-h-10 text-sm text-[#171715]/55">
                  {product.description}
                </p>
                <div className="mt-4">
                  <WebsiteLink href={product.href}>
                    View official Kessick styles
                  </WebsiteLink>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-[#ad9561]/25 bg-[#f4f1e9] p-4 text-xs leading-relaxed text-[#171715]/65">
          A product marked Sample is for demonstration only. For a real design
          discussion, contact Kessick directly.
        </div>
      </div>
    );
  }

  if (section === "Projects") {
    return (
      <div>
        <PageHeading
          title="Projects"
          description="A sample of how a dealer could review project status. These fictional examples are not connected to customers or live projects."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {sampleProjects.map((project) => (
            <article
              key={project.name}
              className="rounded-xl border border-[#171715]/10 bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SampleBadge />
                  <h2 className="mt-3 text-lg font-semibold">{project.name}</h2>
                </div>
                <span className="rounded-full bg-[#f4f1e9] px-3 py-1 text-xs text-[#171715]/65">
                  {project.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#171715]/55">{project.type}</p>
              <p className="mt-5 border-t border-[#171715]/10 pt-4 text-xs text-[#171715]/45">
                Example only · no proposal, customer details, or project files
                are available in this public preview.
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Notices") {
    return (
      <div>
        <PageHeading
          title="Announcements & notices"
          description="This section demonstrates where Kessick-published dealer updates could appear. Every item below is fictional sample copy, not an active announcement."
        />
        <div className="space-y-4">
          {sampleAnnouncements.map((notice, index) => (
            <article
              key={notice.title}
              className="rounded-xl border border-[#171715]/10 bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#947d4d]">
                    {notice.category}
                  </span>
                </div>
                <SampleBadge />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{notice.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#171715]/60">
                {notice.body}
              </p>
              <p className="mt-4 text-[10px] text-[#171715]/40">
                Sample notice {index + 1} · No current Kessick notice is
                represented
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Resources") {
    return (
      <div>
        <PageHeading
          title="Dealer resources"
          description="An illustrative resource index. No private dealer documents are exposed here; use Kessick's official public resources page for current materials."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sampleResources.map(({ title, category, icon: Icon }) => (
            <article
              key={title}
              className="flex items-start gap-3 rounded-xl border border-[#171715]/10 bg-white p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#947d4d]">
                  {category}
                </span>
                <h2 className="mt-1 text-sm font-semibold">{title}</h2>
                <p className="mt-1 text-[11px] text-[#171715]/45">
                  Sample category · no downloadable file
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-[#171715]/10 bg-white p-5">
          <p className="text-sm font-semibold">Official public resources</p>
          <p className="mt-1 text-xs text-[#171715]/55">
            Open Kessick's website to review public information and materials.
          </p>
          <div className="mt-4">
            <WebsiteLink href="https://kessickwinecellars.com/resources/">
              Browse Kessick resources
            </WebsiteLink>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-[#171715]/15 p-4 text-xs leading-relaxed text-[#171715]/55">
          Teamwork access is dealer-specific and is not linked in this public
          sample. Sign in to your authorized account or contact your Kessick
          representative.
        </div>
      </div>
    );
  }

  if (section === "Forms") {
    return (
      <div>
        <PageHeading
          title="Design requests & forms"
          description="Sample request categories show how project workflows can be organized. No submissions are made from this public preview."
        />
        <section className="mb-5 rounded-xl border border-[#ad9561]/25 bg-[#f4f1e9] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#806936]" />
            <div>
              <h2 className="font-semibold">Ready to discuss a project?</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#171715]/65">
                Use Kessick's official contact form for real design inquiries,
                including Forma and Towers discussions.
              </p>
              <div className="mt-4">
                <WebsiteLink href="https://kessickwinecellars.com/contact/">
                  Open the Kessick contact form
                </WebsiteLink>
              </div>
            </div>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Design request", "Share project context with the Kessick team."],
            ["Forma inquiry", "Discuss a Forma collection project."],
            ["Towers inquiry", "Ask about options for a tower design."],
          ].map(([title, description]) => (
            <article
              key={title}
              className="rounded-xl border border-[#171715]/10 bg-white p-5"
            >
              <SampleBadge />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 min-h-10 text-sm leading-relaxed text-[#171715]/55">
                {description}
              </p>
              <button
                disabled
                className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-[#171715]/10 px-3 py-2 text-[10px] text-[#171715]/45"
              >
                Preview only · no submission <ArrowRight className="h-3 w-3" />
              </button>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#171715]/45">
          Actual dealer design request forms and project records remain
          available only after authorized sign-in.
        </p>
      </div>
    );
  }

  if (section === "Training") {
    return (
      <div>
        <PageHeading
          title="Training & onboarding"
          description="A sample landing page for product orientation and design-process guidance. This preview has no private dealer courses."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              "Product orientation",
              "Introductory overview of Kessick product families.",
              "https://kessickwinecellars.com/our-styles/",
            ],
            [
              "Design process",
              "Learn about the path from project concept to a custom wine cellar.",
              "https://kessickwinecellars.com/process/",
            ],
          ].map(([title, description, href]) => (
            <article
              key={title}
              className="rounded-xl border border-[#171715]/10 bg-white p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <GraduationCap className="h-5 w-5 text-[#947d4d]" />
                <SampleBadge />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-[#171715]/55">{description}</p>
              <div className="mt-5">
                <WebsiteLink href={href}>Read public guidance</WebsiteLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (section === "Pricing") {
    return (
      <div>
        <PageHeading
          title="Wholesale pricing"
          description="A sample of where dealer pricebooks would appear. Account-specific pricing stays private and is not displayed in a public preview."
        />
        <section className="rounded-xl border border-[#ad9561]/30 bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#806936]" />
            <div>
              <h2 className="font-semibold">
                Dealer-specific pricing stays private
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#171715]/60">
                This sample has no wholesale rates, SKUs, discount details, or
                pricebook files. Approved dealer accounts see only the pricing
                authorized for them.
              </p>
            </div>
          </div>
        </section>
        <div className="mt-4 rounded-xl border border-[#171715]/10 bg-white p-5">
          <SampleBadge />
          <h3 className="mt-4 font-semibold">Example pricebook area</h3>
          <p className="mt-2 text-sm text-[#171715]/55">
            A private dealer view may list current catalogs and account pricing
            after an authorized sign-in.
          </p>
        </div>
      </div>
    );
  }

  if (section === "Support") {
    return (
      <div>
        <PageHeading
          title="Report an issue & get support"
          description="For real assistance, use Kessick's published contact options. This sample preview does not submit tickets or send feedback."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-[#171715]/10 bg-white p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <h2 className="mt-4 font-semibold">Feedback & design requests</h2>
            <p className="mt-2 text-sm text-[#171715]/55">
              Send a note through Kessick's official contact page.
            </p>
            <div className="mt-4">
              <WebsiteLink href="https://kessickwinecellars.com/contact/">
                Contact Kessick
              </WebsiteLink>
            </div>
          </article>
          <article className="rounded-xl border border-[#171715]/10 bg-white p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
              <Mail className="h-4 w-4" />
            </span>
            <h2 className="mt-4 font-semibold">Email Kessick</h2>
            <p className="mt-2 text-sm text-[#171715]/55">
              Reach the Kessick team by email.
            </p>
            <a
              href="mailto:sales@kessickwinecellars.com"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#705a31] hover:underline"
            >
              sales@kessickwinecellars.com{" "}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </article>
          <article className="rounded-xl border border-[#171715]/10 bg-white p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
              <Headphones className="h-4 w-4" />
            </span>
            <h2 className="mt-4 font-semibold">Call Kessick</h2>
            <p className="mt-2 text-sm text-[#171715]/55">
              Speak to the Kessick Wine Cellars team.
            </p>
            <a
              href="tel:+18642971911"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#705a31] hover:underline"
            >
              864.297.1911 <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        title="Sample dealer account"
        description="A fictional account card illustrates how the dealer profile may appear. No real person, company, or email address is represented."
      />
      <section className="max-w-2xl rounded-xl border border-[#171715]/10 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ad9561]/10 text-[#806936]">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">Alex Morgan</h2>
            <p className="text-sm text-[#171715]/55">
              Example Cellars LLC · alex@example.test
            </p>
          </div>
          <div className="ml-auto">
            <SampleBadge />
          </div>
        </div>
        <div className="mt-6 grid gap-4 border-t border-[#171715]/10 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#171715]/45">
              Account status
            </p>
            <p className="mt-1 text-sm">Sample approved dealer</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#171715]/45">
              Account access
            </p>
            <p className="mt-1 text-sm">Illustrative only · no sign-in</p>
          </div>
        </div>
        <p className="mt-5 border-t border-[#171715]/10 pt-4 text-xs leading-relaxed text-[#171715]/45">
          All profile details are fictional. This page does not connect to
          dealer records.
        </p>
      </section>
    </div>
  );
}

export default function DealerPortalPreview({
  staffViewMode = false,
}: {
  staffViewMode?: boolean;
}) {
  const [section, setSection] = useState<PreviewSection>("Home");
  const [search, setSearch] = useState("");

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const entries: SearchResult[] = [
      ...sampleProjects.map((project) => ({
        title: project.name,
        detail: `${project.type} · ${project.status} · Sample`,
        section: "Projects" as const,
      })),
      ...products.map((product) => ({
        title: product.name,
        detail: `${product.description} · Sample`,
        section: "Collections" as const,
      })),
      ...sampleResources.map((resource) => ({
        title: resource.title,
        detail: `${resource.category} · Sample category`,
        section: "Resources" as const,
      })),
      ...sampleAnnouncements.map((notice) => ({
        title: notice.title,
        detail: `${notice.category} · Sample notice`,
        section: "Notices" as const,
      })),
      {
        title: "Design request",
        detail: "Sample form · no public submission",
        section: "Forms",
      },
      {
        title: "Feedback",
        detail: "Official Kessick contact options",
        section: "Support",
      },
      {
        title: "Account profile",
        detail: "Fictional sample account",
        section: "Account",
      },
    ];
    return entries
      .filter((entry) =>
        `${entry.title} ${entry.detail}`.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [search]);

  const navigate = (next: PreviewSection) => {
    setSection(next);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f4f2ed] pb-20 text-[#171715] md:pb-0">
      {staffViewMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#171715] px-4 py-3 text-xs text-white sm:px-6">
          <span className="font-semibold uppercase tracking-[0.12em]">
            Staff-only dealer view · read-only sample, not account impersonation
          </span>
          <a
            href="/admin"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[#d4bd85] px-4 font-semibold text-[#171715] hover:bg-white"
          >
            <ShieldCheck className="h-4 w-4" /> Staff View
          </a>
        </div>
      )}
      <div
        role="alert"
        className="sticky top-0 z-50 flex min-h-9 items-center justify-center gap-2 bg-[#6e3025] px-4 py-2 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-white sm:text-[10px]"
      >
        <span aria-hidden="true">•</span> SAMPLE DEALER PREVIEW · FICTIONAL DATA
        · NO SIGN-IN OR LIVE ACTIONS
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-2.25rem)] max-w-[1600px]">
        <aside className="sticky top-9 hidden h-[calc(100vh-2.25rem)] w-[250px] shrink-0 flex-col border-r border-white/10 bg-[#171715] text-white md:flex">
          <div className="border-b border-white/10 px-6 py-6">
            <BrandLogo tone="light" className="h-6 w-auto" />
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Dealer portal · sample
            </p>
          </div>
          <nav
            aria-label="Sample dealer portal sections"
            className="flex-1 space-y-1 overflow-y-auto p-3"
          >
            {navigation.map(({ label, icon: Icon }) => (
              <button
                key={label}
                aria-current={section === label ? "page" : undefined}
                onClick={() => navigate(label)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition ${section === label ? "bg-[#ad9561]/20 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon
                  className={`h-4 w-4 ${section === label ? "text-[#d9c58e]" : ""}`}
                />
                {label}
              </button>
            ))}
          </nav>
          <div className="m-4 rounded-lg border border-[#ad9561]/25 bg-[#ad9561]/10 p-3 text-[10px] leading-relaxed text-white/65">
            Everything shown here is fictional. No dealer records, pricing, or
            private documents are connected.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#171715] px-4 text-white sm:px-6 md:h-[72px] md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo tone="light" className="h-5 w-auto md:hidden" />
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9c58e] md:block">
                Dealer workspace
              </span>
              <span className="truncate text-xs font-medium text-white/75">
                Alex Morgan{" "}
                <span className="hidden text-white/35 sm:inline">
                  · Example Cellars LLC
                </span>
              </span>
            </div>
            <button
              onClick={() => navigate("Notices")}
              aria-label="Open sample notices"
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d9c58e]" />
            </button>
          </header>

          <section className="relative isolate overflow-visible bg-[#171715] text-white">
            <img
              src={cellarImage}
              alt=""
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-45"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#171715]/95 via-[#171715]/75 to-[#171715]/35" />
            <div className="mx-auto flex min-h-[260px] max-w-7xl flex-col justify-center px-4 py-8 sm:min-h-[300px] sm:px-7 sm:py-10 lg:px-10">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d9c58e]">
                  Kessick Wine Cellars
                </span>
                <SampleBadge light />
              </div>
              <h1 className="mt-3 max-w-2xl font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Your Kessick project desk.
              </h1>
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
                A dedicated workspace for projects, product inspiration, and
                dealer support.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-[#d9c58e]" /> Alex
                  Morgan
                </span>
                <span className="hidden h-3 w-px bg-white/20 sm:block" />
                <span>Example Cellars LLC</span>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-7xl space-y-7 px-4 pb-9 pt-6 sm:px-7 sm:pt-8 lg:px-10">
            {section === "Home" ? (
              <PreviewDashboard
                onNavigate={navigate}
                onSearch={setSearch}
                search={search}
                results={searchResults}
              />
            ) : (
              <SectionContent section={section} onNavigate={navigate} />
            )}
            <footer className="border-t border-[#171715]/10 pt-5 text-[10px] leading-relaxed text-[#171715]/45 sm:text-xs">
              Public sample preview only. No dealer account or private content
              is connected. Public product links open the official Kessick Wine
              Cellars website.
              <span className="ml-2">
                <WebsiteLink href="https://kessickwinecellars.com/">
                  Visit Kessick Wine Cellars
                </WebsiteLink>
              </span>
            </footer>
          </div>
        </main>
      </div>
      <nav
        aria-label="Sample dealer mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/10 bg-[#fbfaf7]/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(23,23,21,.09)] backdrop-blur-md md:hidden"
      >
        {mobileNavigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            aria-current={section === label ? "page" : undefined}
            onClick={() => navigate(label)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 ${section === label ? "text-[#715b32]" : "text-[#171715]/45"}`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="text-[9px] font-semibold leading-none">
              {label === "Notices" ? "Notices" : label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
