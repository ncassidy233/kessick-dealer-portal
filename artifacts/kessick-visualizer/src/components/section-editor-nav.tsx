import { useSearch } from "wouter";
import { PortalLink } from "./portal-link";
import { dealerContextId, portalSections, sectionEditorHref, sectionPage, type PortalSection } from "@/lib/portal-section";

export function SectionEditorNav({ section, mode }: { section: PortalSection; mode: "content" | "layout" }) {
  const search = useSearch();
  const dealer = dealerContextId(search);
  const label = portalSections[section].label;
  return <section aria-label={`${label} editing tools`} className="border-b border-[#171715]/15 bg-[#f3f0e8] px-4 py-4 text-[#171715] md:px-8">
    <p className="text-sm font-semibold">{label} controls</p>
    <p className="mt-1 text-xs text-[#171715]/70">{section === "collections" ? "Edit product series, finish cards, and their images here. Use Visual layout for the page design." : "Manage this dealer page’s content and layout. Changes stay subject to your editing and publishing permissions."}{dealer && " Content changes apply to the shared portal, not just this dealer."}</p>
    <nav aria-label={`${label} editor`} className="mt-3 flex flex-wrap gap-2 text-sm">
      {(["content", ...(sectionPage(section) ? ["layout" as const] : [])] as const).map(item => <PortalLink key={item} href={sectionEditorHref(section, item, dealer)} aria-current={mode === item ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border border-[#171715]/20 px-4 py-2 font-medium ${mode === item ? "bg-[#171715] text-white" : "bg-white hover:bg-[#b39862]/15"}`}>{item === "content" ? "Content & images" : "Visual layout"}</PortalLink>)}
    </nav>
  </section>;
}
