import { db, accountsTable, portalContentTable, auditEventsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { officialKessickContent, officialContentVersion, officialContentUrl } from "./officialKessickContent";

// A versioned, atomic import authorized for this release. The durable audit marker
// ensures future restarts never resurrect deleted records or overwrite staff edits.
export async function importOfficialKessickContent() {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${officialContentVersion}))`);
    const [done] = await tx.select({ id: auditEventsTable.id }).from(auditEventsTable)
      .where(and(eq(auditEventsTable.action, "portal.official_content.import"), eq(auditEventsTable.targetId, officialContentVersion))).limit(1);
    if (done) return { imported: 0, alreadyImported: true };
    const [owner] = await tx.select({ id: accountsTable.id }).from(accountsTable).where(and(
      inArray(accountsTable.email, ["ncassidy@gerberchildrenswear.com", "ngcassid@gmail.com"]),
      eq(accountsTable.role, "staff"), eq(accountsTable.status, "approved"),
    )).limit(1);
    if (!owner) throw new Error("Official content import requires an existing approved portal owner.");
    const existing = await tx.select().from(portalContentTable);
    let imported = 0;
    for (const entry of officialKessickContent) {
      const sourceUrl = officialContentUrl(entry.path);
      if (existing.some(row => row.kind === entry.kind && row.title.trim().toLowerCase() === entry.title.toLowerCase())) continue;
      await tx.insert(portalContentTable).values({ kind: entry.kind, title: entry.title,
        description: entry.description, visibility: "everyone", published: true,
        createdByAccountId: owner.id,
        payload: { contentType: entry.kind, url: sourceUrl, sourceUrl,
          sourceReviewedAt: "2026-11-01", sourceImport: officialContentVersion,
          ...(entry.category ? { category: entry.category } : {}),
          ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
          ...(entry.kind === "form" ? { externalForm: true } : {}),
        },
      });
      imported++;
    }
    await tx.insert(auditEventsTable).values({ actorAccountId: null,
      action: "portal.official_content.import", targetType: "content_catalog", targetId: officialContentVersion,
      metadata: { imported, source: "https://kessickwinecellars.com", preserveExisting: true },
    });
    return { imported, alreadyImported: false };
  });
}
