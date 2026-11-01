import { studioPageDocumentSchema, promotionSchema } from "@workspace/api-zod";
import { z } from "zod";

const text = z.string().nullish();
const timestamp = z.union([z.string(), z.date().transform(value => value.toISOString())]).nullish();
const group = z.object({ id: z.string(), name: z.string() });
const organization = z.object({ id: z.string(), name: z.string(), status: z.string() });
const payload = z.object({
  legacyId: text, contentType: text, imageUrl: text, url: text, category: text,
  externalForm: z.boolean().optional(), promotion: z.unknown().transform(value => value === undefined ? undefined : promotionSchema.parse(value)).optional(),
  status: text, clientName: text, color: text,
  featuredOnDashboard: z.boolean().optional(), comingSoon: z.boolean().optional(),
});
const content = z.object({
  id: z.string(), kind: z.string(), title: z.string(), description: text,
  payload, published: z.literal(true), createdAt: timestamp, updatedAt: timestamp,
});
const field = z.object({
  name: z.string().optional(), label: z.string(), type: z.string(),
  required: z.boolean().optional(), options: z.array(z.string()).optional(),
});
const resource = z.object({
  id: z.string(), title: z.string(), category: z.string(), description: text,
  url: z.string(), enabled: z.boolean(),
});
const notification = z.object({
  id: z.string(), title: z.string(), body: z.string(), imageUrl: text, linkUrl: text,
  priority: z.enum(["low", "normal", "high"]), status: z.literal("sent"),
  sentAt: timestamp, expiresAt: timestamp, acknowledgementRequired: z.boolean(),
});

const responses: Record<string, z.ZodType> = {
  "/portal-v2/bootstrap": z.object({
    role: z.literal("dealer"), authorized: z.literal(true),
    account: z.object({
      id: z.string(), email: z.string(), displayName: text, status: z.literal("approved"),
      assignedRep: z.object({ email: z.string(), displayName: text }).nullish(),
    }),
    capabilities: z.array(z.string()), groups: z.array(group), organization: organization.nullable(),
  }),
  "/portal-v2/content": z.object({ content: z.array(content) }),
  "/portal-v2/projects": z.object({ content: z.array(content) }),
  "/portal-v2/notifications": z.object({
    notifications: z.array(z.object({
      notification,
      recipient: z.object({
        id: z.string(), notificationId: z.string(), accountId: z.string(),
        readAt: timestamp, acknowledgedAt: timestamp,
      }),
    })),
  }),
  "/portal-v2/notification-preferences": z.object({
    preferences: z.object({ inAppEnabled: z.boolean(), pushEnabled: z.boolean(), priorityThreshold: z.enum(["low", "normal", "high"]) }),
  }),
  "/dealer-portal/access": z.object({ groupId: z.string().nullable(), groupIds: z.array(z.string()), capabilities: z.record(z.string(), z.boolean()) }),
  "/dealer-portal/resources": z.array(resource),
  "/dealer-portal/forms": z.array(z.object({
    id: z.string(), title: z.string(), description: text, enabled: z.boolean(), fieldDefinitions: z.array(field),
  })),
  "/dealer-portal/pricing": z.array(z.object({
    id: z.string(), pricebookId: z.string(), sku: z.string(), currency: z.string(),
    wholesaleAmount: z.union([z.string(), z.number()]).nullable(), status: z.string(),
  })),
  "/dealer-portal/dashboard": z.object({
    organization, groupId: z.string().nullable(),
    counts: z.object({ forms: z.number(), resources: z.number(), unreadNotifications: z.number() }),
  }),
  "/dealer-portal/push-config": z.object({ configured: z.boolean(), publicKey: text }),
};

/** Strip unapproved fields even when the underlying dealer handler grows. */
export function staffDealerResponse(path: string, value: unknown): unknown {
  const schema = /^\/portal-v2\/pages\/(?:home|projects|collections|training|resources)$/.test(path)
    ? z.object({ page: z.object({ document: z.unknown().transform(value => studioPageDocumentSchema.parse(value)), revision: z.number().int() }) })
    : responses[path];
  if (!schema) throw new Error("Unapproved Dealer View response.");
  return schema.parse(value);
}
