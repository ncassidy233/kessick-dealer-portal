import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

test("verified primary emails cannot transfer staff grants, reclaim identities or reverse revocation", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async t => {
  const { db, pool, accountsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { createRequireAccount, getAuthorizedStaffRole, requireActiveAccount } = await import("./auth");
  const connection = await pool.connect();
  let server: ReturnType<typeof express.application.listen> | undefined;
  let queries: ReturnType<typeof t.mock.method> | undefined;
  try {
    await connection.query("BEGIN");
    for (const table of ["accounts", "portal_staff_profiles"]) await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`);
    queries = t.mock.method(pool, "query", connection.query.bind(connection));
    const [staff, invited] = await db.insert(accountsTable).values([
      { clerkUserId: "test_staff_identity", email: "approved-staff@example.invalid", role: "staff" as const, status: "approved" as const, emailVerified: true },
      { clerkUserId: "staff:invited-staff@example.invalid", email: "invited-staff@example.invalid", role: "staff" as const, status: "approved" as const, emailVerified: false },
    ]).returning();
    await connection.query("INSERT INTO portal_staff_profiles(account_id,role,authorized_at,authorized_clerk_user_id) VALUES ($1,'super_admin',now(),$2),($3,'content_manager',null,null)", [staff.id, staff.clerkUserId, invited.id]);
    const identity = (email: string, verified = true, primary = true) => ({ primaryEmailAddressId: primary ? "email_primary" : null, firstName: null, lastName: null, emailAddresses: [{ id: "email_primary", emailAddress: email, verification: { status: verified ? "verified" : "unverified" } }] });
    const users = new Map([
      [staff.clerkUserId, identity(staff.email)],
      ["test_invited_identity", identity(invited.email)],
      ["test_unverified", identity(staff.email, false)],
      ["test_missing_primary", identity(staff.email, true, false)],
      ["test_different_identity", identity(staff.email)],
      ["test_stranger", identity("stranger@example.invalid")],
    ]);
    const bridge = createRequireAccount({ userId: req => req.header("x-test-identity") ?? null, user: async id => { const user = users.get(id); assert.ok(user); return user; } });
    const app = express();
    app.use((req, _res, next) => { req.log = { error() {} } as unknown as typeof req.log; next(); });
    app.use(bridge);
    app.get("/account", (req, res) => res.json({ role: req.account!.role, email: req.account!.email }));
    app.get("/staff", requireActiveAccount, async (req, res) => {
      const role = await getAuthorizedStaffRole(req);
      if (!role) { res.status(403).json({ error: "Staff access required." }); return; }
      res.json({ role, canary: "STAFF_ONLY_TEST_FIXTURE" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const call = (id?: string, path = "/staff") => fetch(`http://127.0.0.1:${address.port}${path}?role=super_admin&staff=true`, { headers: { ...(id ? { "x-test-identity": id } : {}), "x-role": "super_admin", "x-email-verified": "true" } });
    assert.equal((await call()).status, 401);
    for (const id of ["test_unverified", "test_missing_primary", "test_different_identity"]) assert.equal((await call(id)).status, 403, id);
    assert.equal((await call("test_stranger")).status, 403);
    assert.equal((await (await call("test_stranger", "/account")).json() as { role: string }).role, "customer");
    assert.equal((await call(staff.clerkUserId)).status, 200);
    users.set(staff.clerkUserId, identity("changed-staff@example.invalid"));
    assert.equal((await call(staff.clerkUserId)).status, 403);
    const [unchanged] = await db.select().from(accountsTable).where(eq(accountsTable.id, staff.id));
    assert.equal(unchanged.email, staff.email);
    users.set(staff.clerkUserId, identity(staff.email.toUpperCase()));
    assert.equal((await call(staff.clerkUserId)).status, 200);
    assert.equal((await call("test_invited_identity")).status, 200);
    assert.equal((await connection.query("SELECT authorized_clerk_user_id FROM portal_staff_profiles WHERE account_id=$1", [invited.id])).rows[0].authorized_clerk_user_id, "test_invited_identity");
    await connection.query("UPDATE portal_staff_profiles SET authorized_at=null WHERE account_id=$1", [invited.id]);
    assert.equal((await call("test_invited_identity")).status, 403);
    await connection.query("UPDATE accounts SET status='suspended' WHERE id=$1", [staff.id]);
    assert.equal((await call(staff.clerkUserId)).status, 403);
    const [owner] = await db.select().from(accountsTable).where(eq(accountsTable.id, staff.id));
    assert.equal(owner.clerkUserId, staff.clerkUserId);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    queries?.mock.restore(); await connection.query("ROLLBACK"); connection.release(); await pool.end();
  }
});
