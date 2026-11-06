import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { officialKessickContent } from "./officialKessickContent";
test("official import preserves edits, omissions and deleted records across restarts", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async () => {
  const { db, pool, accountsTable, portalContentTable, auditEventsTable } = await import("@workspace/db");
  const { eq, sql } = await import("drizzle-orm");
  const { importOfficialKessickContentInTransaction } = await import("./importOfficialKessickContent");
  const ownerId = randomUUID();
  const preexistingId = randomUUID();
  try {
    await db.transaction(async tx => {
    for (const table of ["accounts", "portal_content_v2", "audit_events"]) await tx.execute(sql.raw(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`));
    const deferred = await importOfficialKessickContentInTransaction(tx);
    assert.equal(deferred.deferred, true);
    assert.equal((await tx.select().from(auditEventsTable)).length, 0);
    await tx.insert(accountsTable).values({ id: ownerId, email: "ngcassid@gmail.com", clerkUserId: `test_${randomUUID()}`, role: "staff", status: "approved" });
    await tx.insert(portalContentTable).values({ id: preexistingId, kind: "product_series", title: "Estate", description: "Staff-owned description", published: false, createdByAccountId: ownerId });
    const result = await importOfficialKessickContentInTransaction(tx);
    assert.equal(result.imported, officialKessickContent.length - 1);
    const [preserved] = await tx.select().from(portalContentTable).where(eq(portalContentTable.id, preexistingId));
    assert.equal(preserved.description, "Staff-owned description");
    assert.equal(preserved.published, false);
    const [form] = await tx.select().from(portalContentTable).where(eq(portalContentTable.title, "Design Request"));
    assert.equal((form.payload as { externalForm: boolean }).externalForm, true);
    await tx.delete(portalContentTable).where(eq(portalContentTable.id, form.id));
    assert.equal((await importOfficialKessickContentInTransaction(tx)).alreadyImported, true);
    assert.equal((await tx.select().from(portalContentTable).where(eq(portalContentTable.id, form.id))).length, 0);
    });
  } finally {
    await pool.end();
  }
});
