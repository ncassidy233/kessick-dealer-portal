import { z } from "zod";

const secureImageUrl = z.string().url().regex(/^https:\/\/[^/?#@]+(?:[/?#]|$)/i);
const imageUrl = z.string().trim().max(2048).refine(
  value => value === "" || secureImageUrl.safeParse(value).success,
  "Use an HTTPS image URL, or leave it empty for the Kessick image.",
);

/** Public presentation only. Authentication, destinations and dealer data are fixed. */
export const portalPublicBrandingSchema = z.object({
  welcomeTitle: z.string().trim().min(1).max(160),
  welcomeDescription: z.string().trim().max(600),
  signInTitle: z.string().trim().min(1).max(100),
  signInDescription: z.string().trim().max(300),
  imageUrl,
  imageAlt: z.string().trim().min(1).max(250),
  logoUrl: imageUrl,
  faviconUrl: imageUrl.optional(),
  sideHeading: z.string().trim().min(1).max(160),
  sideDescription: z.string().trim().max(400),
}).strict();

export type PortalPublicBranding = z.infer<typeof portalPublicBrandingSchema>;

export const defaultPortalPublicBranding: PortalPublicBranding = {
  welcomeTitle: "The Private Portal for Kessick Partners.",
  welcomeDescription: "Access wholesale pricebooks, download architectural resources, submit forms, and review new product collections in one secure environment.",
  signInTitle: "Welcome back.",
  signInDescription: "Sign in to your Kessick account to continue.",
  imageUrl: "",
  imageAlt: "Custom Kessick wine cellar",
  logoUrl: "",
  sideHeading: "Extraordinary spaces.\nExceptional partnerships.",
  sideDescription: "The resources, collections and support for your next Kessick project.",
};

export function publicPortalBranding(value: unknown): PortalPublicBranding | null {
  const result = portalPublicBrandingSchema.safeParse(value);
  return result.success ? result.data : null;
}
