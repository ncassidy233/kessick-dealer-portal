import { z } from "zod";
export const promotionSchema = z.object({
  percentOff: z.number().positive().max(100),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  collections: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  terms: z.string().trim().min(1).max(2000),
  minimumOrder: z.number().nonnegative().max(10000000).default(0),
  maximumSavings: z.number().positive().max(10000000).optional(),
  combinable: z.boolean().default(false),
}).strict().refine(v => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "End date must follow start date" });
export function activePromotion(value: unknown, now = new Date()) {
  const parsed = promotionSchema.safeParse(value);
  return parsed.success && Date.parse(parsed.data.startsAt) <= now.getTime() && now.getTime() < Date.parse(parsed.data.endsAt) ? parsed.data : null;
}
