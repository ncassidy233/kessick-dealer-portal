import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { randomUUID } from "node:crypto";

test("all staff namespaces deny dealers, spoofed roles, unclaimed and revoked staff on every method", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async t => {
  const { db, pool, accountsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { createStaffBoundary } = await import("./staffBoundary");
  const connection = await pool.connect();
  let server: ReturnType<typeof express.application.listen> | undefined;
  let queries: ReturnType<typeof t.mock.method> | undefined;
  try {
    await connection.query("BEGIN");
    for (const table of ["accounts", "portal_staff_profiles"]) await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`);
    queries = t.mock.method(pool, "query", connection.query.bind(connection));
    const fixtures = await db.insert(accountsTable).values([
      { role: "dealer" as const, status: "approved" as const }, { role: "customer" as const, status: "approved" as const },
      { role: "staff" as const, status: "pending" as const }, { role: "staff" as const, status: "suspended" as const },
      ...Array.from({ length: 7 }, () => ({ role: "staff" as const, status: "approved" as const })),
    ].map(value => ({ ...value, id: randomUUID(), clerkUserId: `test_${randomUUID()}`, email: `${randomUUID()}@example.invalid` }))).returning();
    const [dealer, customer, pending, suspended, unclaimed, wrongIdentity, owner, admin, sales, content, noProfile] = fixtures;
    for (const [account, role, claim] of [[dealer, "super_admin", dealer.clerkUserId], [pending, "super_admin", pending.clerkUserId], [suspended, "super_admin", suspended.clerkUserId], [unclaimed, "super_admin", null], [wrongIdentity, "super_admin", "different_identity"], [owner, "super_admin", owner.clerkUserId], [admin, "staff_admin", admin.clerkUserId], [sales, "sales_rep", sales.clerkUserId], [content, "content_manager", content.clerkUserId]] as const) {
      await connection.query("INSERT INTO portal_staff_profiles(account_id,role,authorized_at,authorized_clerk_user_id) VALUES ($1,$2,$3,$4)", [account.id, role, claim ? new Date() : null, claim]);
    }
    const app = express(); let reached = 0;
    const authenticated: express.RequestHandler = async (req, res, next) => {
      const id = req.header("x-test-account");
      if (!id) { res.status(401).end(); return; }
      [req.account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id)); next();
    };
    app.use("/api", createStaffBoundary(authenticated));
    app.use((_req, res) => { reached++; res.json({ staffSecret: "must never reach a dealer" }); });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const paths = ["/staff/portal/forms", "/staff/concierge/knowledge", "/staff/dealer-organizations", "/staff/dealer-view", "/staff/future-feature", "/portal-v2/admin/users", "/portal-v2/admin/pages/home/draft", "/portal-v2/admin/content", "/portal-v2/admin/future-feature", "/STAFF/portal/forms", "/Portal-v2/ADMIN/content/"];
    const call = (path: string, accountId?: string, method = "GET") => fetch(`http://127.0.0.1:${address.port}/api${path}?role=super_admin`, { method, headers: { ...(accountId ? { "x-test-account": accountId } : {}), "x-role": "super_admin", "x-staff": "true" } });
    for (const path of paths) {
      assert.equal((await call(path)).status, 401);
      for (const account of [dealer, customer, pending, suspended, unclaimed, wrongIdentity, noProfile]) for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]) assert.equal((await call(path, account.id, method)).status, 403, `${account.role}/${account.status} ${method} ${path}`);
    }
    assert.equal(reached, 0);
    for (const account of [owner, admin, sales, content]) assert.equal((await call("/staff/future-feature", account.id)).status, 200);
    await connection.query("UPDATE portal_staff_profiles SET authorized_at = null WHERE account_id = $1", [owner.id]);
    assert.equal((await call("/portal-v2/admin/content", owner.id)).status, 403);
    assert.equal(reached, 4);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    queries?.mock.restore(); await connection.query("ROLLBACK"); connection.release(); await pool.end();
  }
});
