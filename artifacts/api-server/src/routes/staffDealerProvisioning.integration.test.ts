import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";

const disposableDatabase = process.env.KNOWLEDGE_DB_INTEGRATION_TEST === "1"
  && process.env.NODE_ENV === "test" && Boolean(process.env.DATABASE_URL)
  && ["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname);

test("staff-added dealer access is approved independently of invitation delivery", { skip: !disposableDatabase }, async t => {
  process.env.CLERK_SECRET_KEY = "sk_test_kessick_disposable_fixture";
  const { db, pool, accountsTable, portalStaffProfilesTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { portalV2Handlers } = await import("./portalV2");
  const { createStaffBoundary } = await import("../middlewares/staffBoundary");
  const { repairStaffAddedDealerInvitations } = await import("../lib/staffDealerProvisioning");
  const connection = await pool.connect();
  const queries = t.mock.method(pool, "query", connection.query.bind(connection));
  // PGlite's wire adapter uses one connection. Real SQL transactions still
  // run on that connection; production continues to use the normal pool.
  const connections = t.mock.method(pool, "connect", async () => ({ query: connection.query.bind(connection), release() {} }) as never);
  const ids: string[] = [];
  const email = () => `${randomUUID()}@example.invalid`;
  const fixture = async (role: "dealer" | "staff" | "customer", status: "pending" | "approved" | "suspended" = "approved", claimed = true) => {
    const address = email();
    const [row] = await db.insert(accountsTable).values({ email: address, clerkUserId: claimed ? `user_${randomUUID()}` : `invited:${address}`, role, status, emailVerified: claimed }).returning();
    ids.push(row.id); return row;
  };
  const staff = await fixture("staff");
  const dealer = await fixture("dealer");
  const manager = await fixture("staff");
  for (const [account, role] of [[staff, "staff_admin"], [manager, "content_manager"]] as const) {
    await db.insert(portalStaffProfilesTable).values({ accountId: account.id, role, authorizedAt: new Date(), authorizedClerkUserId: account.clerkUserId });
  }
  let invitationCalls = 0;
  let failDelivery = false;
  const realFetch = globalThis.fetch.bind(globalThis);
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "127.0.0.1") return realFetch(input, init);
    assert.equal(url.hostname, "api.clerk.com", "No real provider requests are allowed in this test");
    assert.equal(url.pathname, "/v1/invitations");
    if (request.method === "GET") return Response.json({ data: [], total_count: 0 });
    assert.equal(request.method, "POST"); invitationCalls++;
    const body = await request.json() as { email_address: string; notify: boolean };
    const [saved] = await db.select().from(accountsTable).where(eq(accountsTable.email, body.email_address));
    assert.equal(saved?.status, "approved", "Access must be committed before notification");
    assert.equal(body.notify, true);
    if (failDelivery) return Response.json({ errors: [{ code: "email_delivery_failed", message: "Synthetic mail failure" }] }, { status: 400 });
    return Response.json({ object: "invitation", id: `inv_${randomUUID()}`, email_address: body.email_address, status: "pending", url: "https://setup.example.invalid/invitation", created_at: Date.now(), updated_at: Date.now() }, { status: 201 });
  });
  const authenticate: express.RequestHandler = async (req, res, next) => {
    const id = req.header("x-test-account");
    if (!id) { res.status(401).end(); return; }
    [req.account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
    next();
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.log = { error() {}, warn() {}, info() {} } as never; next(); });
  app.use("/api", createStaffBoundary(authenticate), portalV2Handlers);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const add = async (body: object, actor: string | null = staff.id) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/portal-v2/admin/users`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://portal.example.invalid", ...(actor ? { "x-test-account": actor } : {}) }, body: JSON.stringify(body),
    });
    const result = response.status === 401 ? {} : await response.json() as any;
    if (result.user && !ids.includes(result.user.id)) ids.push(result.user.id);
    return { response, ...result };
  };
  const access = async (id: string) => (await pool.query(`SELECT a.role,a.status,a.clerk_user_id,a.email_verified,
    m.status AS membership_status,m.role AS membership_role,o.status AS organization_status,o.approved_by_account_id
    FROM accounts a JOIN organization_memberships m ON m.account_id=a.id
    JOIN dealer_organizations o ON o.id=m.organization_id WHERE a.id=$1`, [id])).rows[0];
  try {
    await t.test("new staff-added dealer is approved even when an old client sends pending", async () => {
      const result = await add({ email: email(), role: "dealer", status: "pending" });
      assert.equal(result.response.status, 201, result.error);
      assert.equal(result.user.status, "approved");
      assert.equal(result.user.invitation.deliveryStatus, "submitted");
      const row = await access(result.user.id);
      assert.equal(row.membership_status, "approved"); assert.equal(row.organization_status, "approved");
      assert.equal(row.membership_role, "owner"); assert.equal(row.approved_by_account_id, staff.id);
      assert.equal(row.email_verified, false, "Provisioning must not pretend the dealer verified email");
      assert.ok(row.clerk_user_id.startsWith("invited:"));
    });
    await t.test("failed email delivery leaves approved access and supplies a working sign-in destination", async () => {
      failDelivery = true;
      const result = await add({ email: email(), role: "dealer" }); failDelivery = false;
      assert.equal(result.response.status, 201, result.error); assert.equal(result.user.status, "approved");
      assert.equal(result.user.invitation.deliveryStatus, "failed");
      assert.equal(result.user.invitation.url, "https://portal.example.invalid/sign-in?redirect_url=%2Fportal");
      assert.equal((await access(result.user.id)).organization_status, "approved");
    });
    await t.test("an existing applicant keeps identity, company, and member role while receiving approval", async () => {
      const applicant = await fixture("dealer", "pending");
      const org = randomUUID();
      await pool.query("INSERT INTO dealer_organizations(id,name,slug,status,created_by_account_id) VALUES ($1,'Applicant company',$2,'pending',$3)", [org, randomUUID(), applicant.id]);
      await pool.query("INSERT INTO organization_memberships(organization_id,account_id,role,status) VALUES ($1,$2,'owner','pending')", [org, applicant.id]);
      const before = invitationCalls;
      const result = await add({ email: applicant.email.toUpperCase(), role: "dealer" });
      assert.equal(result.response.status, 200); assert.equal(result.user.id, applicant.id);
      assert.equal(result.user.invitation.deliveryStatus, "not_required"); assert.equal(invitationCalls, before);
      const row = await access(applicant.id);
      assert.equal(row.clerk_user_id, applicant.clerkUserId); assert.equal(row.email_verified, true);
      assert.equal(row.membership_status, "approved"); assert.equal(row.organization_status, "approved");
      assert.equal(row.membership_role, "owner");
    });
    await t.test("an existing customer gains dealer access without replacing the sign-in identity", async () => {
      const customer = await fixture("customer"); const result = await add({ email: customer.email, role: "dealer" });
      assert.equal(result.response.status, 200); assert.equal(result.user.id, customer.id);
      assert.equal((await access(customer.id)).clerk_user_id, customer.clerkUserId);
      assert.equal(result.user.role, "dealer");
    });
    await t.test("suspended accounts, memberships and organizations cannot be reactivated by adding email", async () => {
      const suspended = await fixture("dealer", "suspended");
      assert.equal((await add({ email: suspended.email, role: "dealer" })).response.status, 409);
      for (const level of ["organization", "membership"] as const) {
        const result = await add({ email: email(), role: "dealer" });
        const table = level === "membership" ? "organization_memberships" : "dealer_organizations";
        const condition = level === "membership" ? "account_id=$1" : "id=(SELECT organization_id FROM organization_memberships WHERE account_id=$1)";
        await pool.query(`UPDATE ${table} SET status='suspended' WHERE ${condition}`, [result.user.id]);
        assert.equal((await add({ email: result.user.email, role: "dealer" })).response.status, 409);
        assert.equal((await access(result.user.id))[`${level}_status`], "suspended");
      }
      assert.equal((await add({ email: staff.email, role: "dealer" })).response.status, 409);
    });
    await t.test("dealers and content staff cannot provision accounts or request staff elevation", async () => {
      const before = invitationCalls;
      for (const actor of [dealer.id, manager.id]) assert.equal((await add({ email: email(), role: "dealer" }, actor)).response.status, 403);
      assert.equal((await add({ email: email(), role: "dealer" }, null)).response.status, 401);
      assert.equal((await add({ email: email(), role: "super_admin" })).response.status, 403);
      assert.equal(invitationCalls, before);
    });
    await t.test("old staff invitations are repaired; public applications and later explicit decisions remain pending", async () => {
      const legacy = await fixture("dealer", "pending", false);
      const publicApplicant = await fixture("dealer", "pending");
      const laterDecision = await fixture("dealer", "pending", false);
      const blocked = await fixture("dealer", "pending", false);
      for (const account of [legacy, laterDecision, blocked]) await pool.query("INSERT INTO audit_events(actor_account_id,action,target_type,target_id,metadata,created_at) VALUES ($1,'portal_v2.user.provisioned','account',$2,'{\"role\":\"dealer\"}',now()-interval '1 minute')", [staff.id, account.id]);
      await pool.query("INSERT INTO audit_events(actor_account_id,action,target_type,target_id,metadata) VALUES ($1,'portal_v2.user.updated','account',$2,'{\"changed\":[\"status\"]}')", [staff.id, laterDecision.id]);
      const org = randomUUID();
      await pool.query("INSERT INTO dealer_organizations(id,name,slug,status,created_by_account_id) VALUES ($1,'Suspended company',$2,'suspended',$3)", [org, randomUUID(), blocked.id]);
      await pool.query("INSERT INTO organization_memberships(organization_id,account_id,status) VALUES ($1,$2,'pending')", [org, blocked.id]);
      const result = await repairStaffAddedDealerInvitations(); assert.equal(result.repaired, 1); assert.equal(result.skipped, 1);
      assert.equal((await access(legacy.id)).organization_status, "approved");
      for (const account of [publicApplicant, laterDecision, blocked]) assert.equal((await db.select().from(accountsTable).where(eq(accountsTable.id, account.id)))[0].status, "pending");
      assert.equal((await repairStaffAddedDealerInvitations()).repaired, 0);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); fetchMock.mock.restore();
    const missed = await pool.query("SELECT id FROM accounts WHERE id IN (SELECT created_by_account_id FROM dealer_organizations WHERE approved_by_account_id=$1)", [staff.id]);
    ids.push(...missed.rows.map(row => row.id));
    await pool.query("DELETE FROM audit_events WHERE actor_account_id=$1 OR target_id=ANY($2::text[])", [staff.id, ids]);
    await pool.query("DELETE FROM organization_memberships WHERE account_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM dealer_organizations WHERE created_by_account_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM portal_staff_profiles WHERE account_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM accounts WHERE id=ANY($1::uuid[])", [ids]);
    connections.mock.restore(); queries.mock.restore(); connection.release(); await pool.end();
  }
});
