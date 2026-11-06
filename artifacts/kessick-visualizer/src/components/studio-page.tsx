import { createContext, useContext, type ReactNode, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DealerContentLink } from "@/components/dealer-content-link";
import { usePortalContent, type PortalContent } from "@/hooks/use-portal-v2";
import { usePortalSession } from "@/lib/portal-session";
import { dealerAccessState } from "@/lib/dealer-access";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { dealerQueryKey, dealerReadUrl } from "@/lib/staff-dealer-view";
import {
  isMissingPage,
  parseStudioPage,
  type PageKey,
  type StudioPageDocument,
  type StudioSection,
} from "@/lib/page-studio";

const PublishedLayout = createContext(false);
export const usePublishedLayout = () => useContext(PublishedLayout);

export function PublishedPortalPage({
  pageKey,
  children,
}: {
  pageKey: PageKey;
  children: ReactNode;
}) {
  const view = useStaffDealerView();
  const session = usePortalSession();
  const query = useQuery({
    queryKey: dealerQueryKey(["published-page", pageKey], view),
    queryFn: async ({ signal }) => {
      try {
        const result = await customFetch<{ page: { document: unknown } }>(
          dealerReadUrl(`/api/portal-v2/pages/${pageKey}`, view),
          { responseType: "json", signal },
        );
        return parseStudioPage(result.page.document);
      } catch (error) {
        if (isMissingPage(error)) return null;
        throw error;
      }
    },
    enabled: dealerAccessState(session) === "allowed",
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  // Never keep rendering stale page content after authorization or refresh fails.
  if (query.isError)
    return (
      <div role="alert" className="p-8">
        This page could not be loaded.{" "}
        <button className="underline" onClick={() => query.refetch()}>
          Retry
        </button>
      </div>
    );
  if (query.isPending)
    return (
      <p role="status" className="p-8">
        Loading dealer page…
      </p>
    );
  return (
    <PublishedLayout.Provider
      value={Boolean(
        query.data?.sections.some(
          (section) => section.type === "hero" && !section.hidden,
        ),
      )}
    >
      {query.data && <StudioPage document={query.data} />}
      {children}
    </PublishedLayout.Provider>
  );
}

export function StudioPage({
  document,
  selectedId,
  onSelect,
  preview = false,
  content = [],
}: {
  document: StudioPageDocument;
  selectedId?: string;
  onSelect?: (id: string) => void;
  preview?: boolean;
  content?: PortalContent[];
}) {
  return (
    <div
      className="studio-renderer bg-[#10100f] text-[#f4f0e8]"
      style={{ containerType: "inline-size" }}
    >
      {preview && (
        <div className="border-b border-[#B39862]/40 bg-[#1a1915] p-3 text-center text-xs font-semibold tracking-wider text-[#e6ce98]">
          UNPUBLISHED DRAFT PREVIEW
        </div>
      )}
      {document.sections
        .filter((section) => !section.hidden)
        .map((section) => (
          <section
            key={section.id}
            data-section-id={section.id}
            onClick={() => onSelect?.(section.id)}
            className={`relative overflow-hidden ${section.background === "light" ? "bg-[#f4f0e8] text-[#171715]" : section.background === "gold" ? "bg-[#b39862] text-[#171715]" : "bg-[#10100f] text-[#f4f0e8]"} ${selectedId === section.id ? "outline outline-2 -outline-offset-2 outline-[#d5b971]" : ""}`}
            style={{
              padding:
                section.spacing === "compact"
                  ? "24px"
                  : section.spacing === "generous"
                    ? "80px 24px"
                    : "48px 24px",
              cursor: onSelect ? "pointer" : undefined,
            }}
          >
            {onSelect && (
              <button
                aria-label={`Select ${section.heading}`}
                className="absolute right-2 top-2 z-20 bg-black px-3 py-2 text-xs text-white"
                onClick={() => onSelect(section.id)}
              >
                Edit section
              </button>
            )}
            {section.type === "hero" ? (
              <>
                {section.image && (
                  <>
                    <img
                      src={section.image.url}
                      alt={section.image.alt}
                      className="absolute inset-0 h-full w-full"
                      style={{
                        objectFit: section.image.fit,
                        objectPosition: `${section.image.focalPoint.x}% ${section.image.focalPoint.y}%`,
                      }}
                    />
                    <div className="absolute inset-0 bg-black/70" />
                  </>
                )}
                <div
                  className={`relative mx-auto max-w-6xl ${section.image ? "text-white" : ""}`}
                  style={{ textAlign: section.alignment }}
                >
                  <img
                    src={
                      section.image || section.background === "dark"
                        ? "/kessick-logo-white.svg"
                        : "/kessick-logo-black.svg"
                    }
                    alt="Kessick Wine Cellars"
                    className="mb-10 inline-block h-8 max-w-full"
                  />
                  <h1
                    style={{ fontSize: "clamp(32px, 5cqw, 64px)" }}
                    className="break-words font-serif leading-[1.08]"
                  >
                    {section.heading}
                  </h1>
                  <p className="mt-5 max-w-2xl whitespace-pre-wrap break-words text-base leading-relaxed opacity-90" style={{ marginInline: section.alignment === "center" ? "auto" : undefined, marginLeft: section.alignment === "right" ? "auto" : undefined }}>
                    {section.description}
                  </p>
                  <div
                    className="mt-7 flex flex-wrap gap-3"
                    style={{
                      justifyContent:
                        section.alignment === "center"
                          ? "center"
                          : section.alignment === "right"
                            ? "flex-end"
                            : "flex-start",
                    }}
                  >
                    {section.actions.map((action, index) =>
                      preview ? (
                        <span
                          key={index}
                          className="inline-flex min-h-11 items-center bg-[#d7bd84] px-5 py-3 font-semibold text-[#171715]"
                        >
                          {action.label}
                        </span>
                      ) : (
                        <DealerContentLink
                          key={index}
                          href={action.href}
                          className="inline-flex min-h-11 items-center bg-[#d7bd84] px-5 py-3 font-semibold text-[#171715]"
                        >
                          {action.label}
                        </DealerContentLink>
                      ),
                    )}
                  </div>
                </div>
              </>
            ) : section.type === "text" ? (
              <div className="mx-auto max-w-6xl">
                <h2 className="break-words font-serif text-3xl">
                  {section.heading}
                </h2>
                <p className="mt-5 max-w-3xl whitespace-pre-wrap break-words leading-relaxed opacity-85">
                  {section.body}
                </p>
              </div>
            ) : preview ? (
              <ContentGrid
                section={section}
                content={content.filter(
                  (item) => item.kind === section.source && item.published,
                )}
                preview
              />
            ) : (
              <LiveGrid section={section} />
            )}
          </section>
        ))}
    </div>
  );
}
function LiveGrid({
  section,
}: {
  section: Extract<StudioSection, { type: "content_grid" }>;
}) {
  const query = usePortalContent(section.source);
  if (query.isError) return <p role="alert">Unable to load these resources.</p>;
  return <ContentGrid section={section} content={query.data?.content ?? []} />;
}
function ContentGrid({
  section,
  content,
  preview,
}: {
  section: Extract<StudioSection, { type: "content_grid" }>;
  content: PortalContent[];
  preview?: boolean;
}) {
  const visible = content.filter(
    (item) =>
      !section.contentIds.length || section.contentIds.includes(item.id),
  );
  const destination = {
    project: "projects",
    product_series: "collections",
    training: "training",
    resource: "resources",
    announcement: "notifications",
  }[section.source];
  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="font-serif text-3xl">{section.heading}</h2>
      <div
        className="studio-content-grid mt-6 grid gap-4"
        style={{
          "--studio-grid-columns": section.columns,
        } as CSSProperties}
      >
        {visible.map((item) => (
          <article
            key={item.id}
            className="min-w-0 border border-current/20 p-5"
          >
            <h3 className="break-words text-lg font-semibold">{item.title}</h3>
            <p className="mt-3 break-words text-sm opacity-80">
              {item.description}
            </p>
            {!preview && (
              <DealerContentLink
                href={`/portal/${destination}`}
                className="mt-4 inline-flex min-h-11 items-center underline"
              >
                View {destination}
              </DealerContentLink>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <p className="mt-4 text-sm opacity-70">
          {preview
            ? "Published records for each dealer’s audience appear here."
            : "No resources are currently available in this section."}
        </p>
      )}
    </div>
  );
}
