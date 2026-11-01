import {
  studioPageDocumentSchema,
  type StudioPageDocument,
} from "@workspace/api-zod";
import { customFetch } from "@workspace/api-client-react";
export type { StudioPageDocument };
export type StudioSection = StudioPageDocument["sections"][number];
export type PageKey =
  "home" | "projects" | "collections" | "training" | "resources";
export const studioPages: PageKey[] = [
  "home",
  "projects",
  "collections",
  "training",
  "resources",
];
export const studioSizes = {
  Mobile: [390, 844],
  Tablet: [820, 1180],
  Desktop: [1440, 900],
} as const;
export type StudioDraft = {
  document: StudioPageDocument;
  revision: number;
  updatedAt: string;
  updatedByAccountId: string;
};
export type StudioHistory = {
  history: {
    revision: number;
    publishedAt: string;
    publishedByAccountId: string;
  }[];
  publishedRevision: number;
};
export const studioRequest = <T>(
  page: PageKey,
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) =>
  customFetch<T>(`/api/portal-v2/admin/pages/${page}/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    responseType: "json",
    signal,
  });
export function newSection(type: StudioSection["type"]): StudioSection {
  const shared = {
    id: crypto.randomUUID(),
    background: "dark" as const,
    spacing: "comfortable" as const,
  };
  if (type === "hero")
    return {
      ...shared,
      type,
      heading: "Your Kessick project desk.",
      description: "Everything you need to sell, specify, and deliver.",
      alignment: "left",
      actions: [{ label: "Start a design request", href: "/portal/forms" }],
    };
  if (type === "text")
    return {
      ...shared,
      type,
      heading: "Made for your next project",
      body: "Add your message for Kessick dealer partners.",
    };
  return {
    ...shared,
    type,
    heading: "Explore Kessick",
    source: "product_series",
    contentIds: [],
    columns: 3,
  };
}
export function initialStudioPage(page: PageKey): StudioPageDocument {
  return {
    schemaVersion: 1,
    title:
      page === "home" ? "Dealer home" : page[0].toUpperCase() + page.slice(1),
    sections:
      page === "home"
        ? [
            {
              ...newSection("hero"),
              image: {
                url: "/kessick-headquarters-hero.webp",
                alt: "Kessick Wine Cellars headquarters",
                fit: "cover",
                focalPoint: { x: 50, y: 50 },
              },
            } as StudioSection,
          ]
        : [],
  };
}
export function parseStudioPage(value: unknown) {
  return studioPageDocumentSchema.parse(value);
}
export const isMissingPage = (error: unknown) =>
  error instanceof Error && "status" in error && error.status === 404;
