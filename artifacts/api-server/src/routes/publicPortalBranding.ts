import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, portalPagePublicationsTable } from "@workspace/db";
import { publicPortalBranding } from "@workspace/api-zod";

const router = Router();

router.get("/public/portal-branding", async (_req, res) => {
  // Select only the explicitly public presentation object from the publication.
  // Never read drafts, dealer sections, identity fields, or publication metadata.
  const [published] = await db.select({
    branding: sql<unknown>`${portalPagePublicationsTable.document}->'publicBranding'`,
  }).from(portalPagePublicationsTable).where(eq(portalPagePublicationsTable.pageKey, "home"));
  res.setHeader("Cache-Control", "no-store");
  res.json({ branding: publicPortalBranding(published?.branding) });
});

export default router;
