import { useMemo, useState } from "react";
import {
  customFetch,
  useListDealerPortalResources,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { usePortalContent, type PortalContent } from "@/hooks/use-portal-v2";

type LegacyResource = {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  url: string;
  enabled?: boolean;
};

type DisplayResource = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  url: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function linkedLegacyId(content: PortalContent) {
  return typeof content.payload?.legacyId === "string" ? content.payload.legacyId : null;
}

function resourceUrl(content: PortalContent) {
  return typeof content.payload?.url === "string" ? content.payload.url.trim() : "";
}

function isProtectedResource(url: string) {
  return url.startsWith("/api/dealer-portal/resources/");
}

function isDownloadableUrl(url: string) {
  return /\.(pdf|zip|dwg|docx?|xlsx?|jpe?g|png|webp|txt)(?:$|[?#])/i.test(url);
}

export default function PortalResources() {
  // The legacy resource route applies linked v2 visibility and returns the
  // authenticated file route for stored resources. Keep those records as the
  // source of truth, and layer unlinked v2 resources on top.
  const legacyQuery = useListDealerPortalResources();
  const contentQuery = usePortalContent("resource");
  const [activeCategory, setActiveCategory] = useState("All");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const resources = useMemo<DisplayResource[]>(() => {
    const legacyResources = (legacyQuery.data ?? []) as LegacyResource[];
    const merged = legacyResources.map((resource) => {
      const content = (contentQuery.data?.content ?? []).find(
        (item) => linkedLegacyId(item) === resource.id,
      );
      return {
        id: resource.id,
        title: content?.title || resource.title,
        description: content?.description ?? resource.description,
        category:
          (typeof content?.payload?.category === "string"
            ? content.payload.category
            : resource.category) || "Uncategorized",
        url: resource.url,
      };
    });
    // Linked legacy resources are already represented above. Only add
    // genuinely v2-only resources, preventing duplicate cards.
    for (const content of contentQuery.data?.content ?? []) {
      const linkedId = linkedLegacyId(content);
      if (linkedId) continue;
      const url = resourceUrl(content);
      merged.push({
        id: `content-${content.id}`,
        title: content.title,
        description: content.description,
        category:
          (typeof content.payload?.category === "string"
            ? content.payload.category
            : null) || "Uncategorized",
        url,
      });
    }
    return merged;
  }, [contentQuery.data?.content, legacyQuery.data]);

  const categories = useMemo(() => {
    const values = new Set(resources.map((resource) => resource.category || "Uncategorized"));
    return ["All", ...Array.from(values).sort()];
  }, [resources]);
  const filteredResources = useMemo(
    () =>
      activeCategory === "All"
        ? resources
        : resources.filter((resource) => resource.category === activeCategory),
    [activeCategory, resources],
  );

  const downloadResource = async (resource: DisplayResource) => {
    if (!resource.url || !isProtectedResource(resource.url)) return;
    setDownloadingId(resource.id);
    try {
      const blob = await customFetch<Blob>(resource.url, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resource.title || "Kessick resource";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      toast.error(`Unable to download resource: ${errorMessage(error)}`);
    } finally {
      setDownloadingId(null);
    }
  };

  if (legacyQuery.isLoading || contentQuery.isLoading) {
    return <LoadingState />;
  }

  if (legacyQuery.error) {
    return <ErrorState message={`Unable to load resources: ${errorMessage(legacyQuery.error)}`} />;
  }

  return (
    <div className="flex h-full w-full max-w-6xl flex-col space-y-8 p-6 md:mx-auto md:p-10">
      <header className="shrink-0 space-y-2 border-b border-[#121210]/10 pb-6">
        <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-[#121210]">
          <FolderOpen className="h-8 w-8 text-[#B39862]" />
          Resource Library
        </h1>
        <p className="text-[#121210]/60">
          Download product specs, CAD blocks, and marketing assets.
        </p>
      </header>

      {contentQuery.error && (
        <div className="flex items-start gap-3 border border-[#B39862]/40 bg-[#B39862]/10 p-4 text-sm text-[#121210]/75">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8b382b]" />
          <p>
            Some published resources could not be loaded. Existing resources
            remain available. {errorMessage(contentQuery.error)}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 space-y-1 md:w-64">
          <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-[#121210]/50">
            Categories
          </h2>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`w-full border-l-2 px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeCategory === category
                  ? "border-[#B39862] bg-[#121210]/5 text-[#121210]"
                  : "border-transparent text-[#121210]/60 hover:bg-[#121210]/5"
              }`}
            >
              {category}
            </button>
          ))}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto pb-12">
          {filteredResources.length === 0 ? (
            <div className="border border-[#121210]/10 bg-white p-12 text-center text-[#121210]/50">
              {resources.length === 0
                ? "No resources are currently available for your account."
                : "No resources found in this category."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredResources.map((resource) => {
                const protectedFile = isProtectedResource(resource.url);
                const downloadable = protectedFile || isDownloadableUrl(resource.url);
                return (
                  <div
                    key={resource.id}
                    className="flex flex-col border border-[#121210]/10 bg-white p-5 transition-colors hover:border-[#B39862]/50"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <h3 className="font-medium text-[#121210]">{resource.title}</h3>
                        <span className="shrink-0 border border-[#121210]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[#121210]/50">
                          {resource.category}
                        </span>
                      </div>
                      {resource.description && (
                        <p className="mb-4 line-clamp-3 text-sm text-[#121210]/60">
                          {resource.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end border-t border-[#121210]/10 pt-4">
                      {protectedFile ? (
                        <button
                          type="button"
                          disabled={downloadingId === resource.id}
                          onClick={() => downloadResource(resource)}
                          className="inline-flex items-center text-sm font-medium text-[#806936] transition-colors hover:text-[#121210] disabled:cursor-wait disabled:opacity-60"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {downloadingId === resource.id ? "Downloading…" : "Download File"}
                        </button>
                      ) : resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-[#806936] transition-colors hover:text-[#121210] hover:underline"
                        >
                          {downloadable ? (
                            <>
                              <Download className="mr-2 h-4 w-4" /> Download File
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" /> Open Link
                            </>
                          )}
                        </a>
                      ) : (
                        <span className="text-sm text-[#8b382b]">File unavailable</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
          <h2 className="font-medium">Resources are unavailable</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}