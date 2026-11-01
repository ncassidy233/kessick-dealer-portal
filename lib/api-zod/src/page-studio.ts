import { z } from "zod";

export const studioPageKeySchema = z.enum([
  "home",
  "projects",
  "collections",
  "training",
  "resources",
]);
const webUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "Only web URLs are allowed.");
const action = z
  .object({
    label: z.string().trim().min(1).max(80),
    href: z.union([
      webUrl,
      z
        .string()
        .regex(
          /^\/portal(?:\/(?:projects|collections|training|pricing|resources|forms|notifications|account))?$/,
        ),
    ]),
  })
  .strict();
const section = {
  id: z.string().uuid(),
  hidden: z.boolean().optional(),
  background: z.enum(["dark", "light", "gold"]),
  spacing: z.enum(["compact", "comfortable", "generous"]),
};
const heading = z.string().trim().min(1).max(200);
const hero = z
  .object({
    ...section,
    type: z.literal("hero"),
    heading,
    description: z.string().max(2000),
    alignment: z.enum(["left", "center", "right"]),
    image: z
      .object({
        url: z.union([webUrl, z.literal("/kessick-headquarters-hero.webp")]),
        alt: z.string().trim().min(1).max(300),
        fit: z.enum(["cover", "contain"]),
        focalPoint: z
          .object({
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          })
          .strict(),
      })
      .strict()
      .optional(),
    actions: z.array(action).max(2),
  })
  .strict();
const text = z
  .object({
    ...section,
    type: z.literal("text"),
    heading,
    body: z.string().max(10000),
  })
  .strict();
const contentGrid = z
  .object({
    ...section,
    type: z.literal("content_grid"),
    heading,
    source: z.enum([
      "project",
      "product_series",
      "training",
      "resource",
      "announcement",
    ]),
    contentIds: z.array(z.string().uuid()).max(24),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();

export const studioPageDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(160),
    sections: z
      .array(z.discriminatedUnion("type", [hero, text, contentGrid]))
      .max(40),
  })
  .strict()
  .superRefine((page, context) => {
    if (
      new Set(page.sections.map((item) => item.id)).size !==
      page.sections.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Section identifiers must be unique.",
      });
    }
  });

export const studioDraftInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2_000_000_000),
    document: studioPageDocumentSchema,
  })
  .strict();

export const studioPublishInputSchema = z
  .object({
    expectedDraftRevision: z.number().int().min(1).max(2_000_000_000),
    expectedPublishedRevision: z.number().int().min(0).max(2_000_000_000),
  })
  .strict();
export const studioRestoreInputSchema = z
  .object({
    revision: z.number().int().min(1).max(2_000_000_000),
    expectedPublishedRevision: z.number().int().min(0).max(2_000_000_000),
  })
  .strict();

export type StudioPageDocument = z.infer<typeof studioPageDocumentSchema>;
