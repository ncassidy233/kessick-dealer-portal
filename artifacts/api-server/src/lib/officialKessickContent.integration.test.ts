import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { officialKessickContent, officialContentVersion } from "./officialKessickContent";
test("official import preserves edits, omissions and deleted records across restarts", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async () => {
  const { db, pool, accountsTable, portalContentTable, auditEventsTable } = await import("@workspace/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { importOfficialKessickContent } = await import("./importOfficialKessickContent");
  const ownerId = randomUUID();
  const preexistingId = randomUUID();
  try {
    await db.insert(accountsTable).values({ id: ownerId, email: "ngcassid@gmail.com", clerkUserId: `test_${randomUUID()}`, role: "staff", status: "approved" });
    await db.insert(portalContentTable).values({ id: preexistingId, kind: "product_series", title: "Estate", description: "Staff-owned description", published: false, createdByAccountId: ownerId });
    const result = await importOfficialKessickContent();
    assert.equal(result.imported, officialKessickContent.length - 1);
    const [preserved] = await db.select().from(portalContentTable).where(eq(portalContentTable.id, preexistingId));
    assert.equal(preserved.description, "Staff-owned description");
    assert.equal(preserved.published, false);
    const [form] = await db.select().from(portalContentTable).where(eq(portalContentTable.title, "Design Request"));
    assert.equal((form.payload as { externalForm: boolean }).externalForm, true);
    await db.delete(portalContentTable).where(eq(portalContentTable.id, form.id));
    assert.equal((await importOfficialKessickContent()).alreadyImported, true);
    assert.equal((await db.select().from(portalContentTable).where(eq(portalContentTable.id, form.id))).length, 0);
  } finally {
    await db.delete(portalContentTable).where(eq(portalContentTable.createdByAccountId, ownerId));
    await db.delete(auditEventsTable).where(eq(auditEventsTable.targetId, officialContentVersion));
    await db.delete(accountsTable).where(eq(accountsTable.id, ownerId));
    await pool.end();
  }
});
