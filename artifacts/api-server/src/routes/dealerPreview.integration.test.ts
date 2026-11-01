import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";

test("staff Dealer View reuses real dealer visibility without drafts, writes, or identity changes", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async t => {
  const { db, pool, accountsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { createDealerPreviewRouter, isDealerPreviewRead } = await import("./dealerPreview");
  const connection = await pool.connect();
  let queryMock: ReturnType<typeof t.mock.method> | undefined;
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    await connection.query("BEGIN");
    for (const table of ["accounts", "portal_staff_profiles", "dealer_organizations", "organization_memberships",
      "portal_groups", "portal_group_assignments", "portal_group_memberships_v2", "portal_dealer_profiles",
      "portal_content_v2", "portal_content_targets_v2", "portal_access_rules", "portal_resources", "portal_forms",
      "portal_notification_preferences_v2", "portal_notifications_v2", "portal_notification_recipients_v2",
      "portal_price_overrides", "pricebooks", "pricebook_lines", "audit_events"]) {
      await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`);
    }
    queryMock = t.mock.method(pool, "query", connection.query.bind(connection));
    const [staff, dealerA, dealerB, manager, unclaimed, sales, owner] = await db.insert(accountsTable).values(
      (["staff", "dealer", "dealer", "staff", "staff", "staff", "staff"] as const).map(role => ({
        id: randomUUID(), clerkUserId: `test_${randomUUID()}`, email: `${randomUUID()}@example.invalid`, role, status: "approved" as const,
      })),
    ).returning();
    for (const [account, role, clerkId] of [[staff, "staff_admin", staff.clerkUserId], [manager, "content_manager", manager.clerkUserId], [unclaimed, "staff_admin", "wrong_clerk_id"], [sales, "sales_rep", sales.clerkUserId], [owner, "super_admin", owner.clerkUserId]] as const) {
      await connection.query("INSERT INTO portal_staff_profiles(account_id,role,authorized_at,authorized_clerk_user_id) VALUES ($1,$2,now(),$3)", [account.id, role, clerkId]);
    }
    const orgId = randomUUID();
    const groupId = randomUUID();
    await connection.query("INSERT INTO dealer_organizations(id,name,slug,status,created_by_account_id) VALUES ($1,'Test org',$2,'approved',$3)", [orgId, randomUUID(), staff.id]);
    for (const dealer of [dealerA, dealerB]) await connection.query("INSERT INTO organization_memberships(organization_id,account_id,status) VALUES ($1,$2,'approved')", [orgId, dealer.id]);
    await connection.query("INSERT INTO portal_groups(id,name) VALUES ($1,'Test group')", [groupId]);
    await connection.query("INSERT INTO portal_group_memberships_v2(group_id,account_id) VALUES ($1,$2)", [groupId, dealerA.id]);
    await connection.query("INSERT INTO portal_dealer_profiles(account_id,assigned_sales_rep_account_id) VALUES ($1,$2)", [dealerA.id, manager.id]);
    for (const [title, published, visibility] of [["Published", true, "everyone"], ["Draft secret", false, "everyone"], ["Group only", true, "groups"], ["Dealer B only", true, "individuals"]] as const) {
      const contentId = randomUUID();
      await connection.query("INSERT INTO portal_content_v2(id,kind,title,published,visibility,created_by_account_id,payload) VALUES ($1,'resource',$2,$3,$4,$5,$6)", [contentId, title, published, visibility, staff.id, JSON.stringify({ category: "Resources", staffNotes: "PRIVATE_STAFF_NOTE", futureSensitiveField: "DENY_NEW_FIELD" })]);
      if (visibility !== "everyone") await connection.query("INSERT INTO portal_content_targets_v2(content_id,group_id,account_id) VALUES ($1,$2,$3)", [contentId, visibility === "groups" ? groupId : null, visibility === "individuals" ? dealerB.id : null]);
      if (title === "Published") await connection.query("INSERT INTO portal_content_targets_v2(content_id,account_id) VALUES ($1,$2)", [contentId, dealerB.id]);
    }
    const app = express();
    let authenticationCalls = 0;
    const observedActors: string[] = [];
    const authenticate: express.RequestHandler = async (req, res, next) => {
      authenticationCalls++;
      const id = req.header("x-test-account");
      if (!id) { res.status(401).end(); return; }
      [req.account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
      res.once("finish", () => { observedActors.push(req.account!.id); });
      next();
    };
    app.use("/api/staff/dealer-view", createDealerPreviewRouter(authenticate));
    const { portalHandlers } = await import("./portal");
    const { portalV2Handlers } = await import("./portalV2");
    app.use("/api/own-portal", express.json(), authenticate, portalHandlers, portalV2Handlers);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const request = (path = "", accountId: string | null = staff.id, method = "GET") => fetch(`http://127.0.0.1:${address.port}/api/staff/dealer-view${path}`, {
      method, headers: accountId ? { "x-test-account": accountId } : {},
    });
    assert.equal((await request("", null)).status, 401);
    for (const account of [dealerA, manager, unclaimed]) assert.equal((await request("", account.id)).status, 403);
    const listing = await request();
    assert.equal(listing.headers.get("cache-control"), "private, no-store");
    const listed = await listing.json() as { dealers: { id: string }[] };
    assert.deepEqual(listed.dealers.map(x => x.id).sort(), [dealerA.id, dealerB.id].sort());
    const titles = async (id: string) => {
      const response = await request(`/${id}/portal-v2/content?kind=resource`);
      assert.equal(response.status, 200);
      const data = await response.json() as { content: { title: string }[] };
      return data.content.map(x => x.title).sort();
    };
    assert.deepEqual(await titles(dealerA.id), ["Group only", "Published"]);
    assert.deepEqual(await titles(dealerB.id), ["Dealer B only", "Published"]);
    const privateContentResponse = await request(`/${dealerA.id}/portal-v2/content`);
    const privateContent = await privateContentResponse.text();
    for (const secret of ["createdByAccountId", "targets", dealerB.id, staff.id, "PRIVATE_STAFF_NOTE", "DENY_NEW_FIELD"]) assert.equal(privateContent.includes(secret), false);
    assert.equal(privateContentResponse.headers.get("cache-control"), "private, no-store");
    const resourceId = randomUUID();
    const resourceContentId = randomUUID();
    await connection.query("INSERT INTO portal_resources(id,title,category,url,enabled,created_by_account_id) VALUES ($1,'Dealer B document','Resources','https://example.invalid/approved-resource',true,$2)", [resourceId, staff.id]);
    await connection.query("INSERT INTO portal_content_v2(id,kind,title,published,visibility,created_by_account_id,payload) VALUES ($1,'resource','Dealer B document',true,'individuals',$2,$3)", [resourceContentId, staff.id, JSON.stringify({ legacyId: resourceId })]);
    await connection.query("INSERT INTO portal_content_targets_v2(content_id,account_id) VALUES ($1,$2)", [resourceContentId, dealerB.id]);
    assert.deepEqual(await (await request(`/${dealerA.id}/dealer-portal/resources`)).json(), []);
    const resourceResponse = await request(`/${dealerB.id}/dealer-portal/resources`);
    const resourceBody = await resourceResponse.text();
    assert.ok(resourceBody.includes("Dealer B document"));
    assert.equal(resourceBody.includes("createdByAccountId"), false);
    assert.equal((await request(`/${dealerA.id}/dealer-portal/resources/${resourceId}/file`)).status, 404);
    for (const [title, status, accountId] of [["Sent A", "sent", dealerA.id], ["Sent B", "sent", dealerB.id], ["Draft notice", "draft", dealerA.id], ["Scheduled notice", "scheduled", dealerA.id]] as const) {
      const notificationId = randomUUID();
      await connection.query("INSERT INTO portal_notifications_v2(id,title,body,status,scheduled_for,created_by_account_id) VALUES ($1,$2,'Test notification',$3,now()-interval '1 minute',$4)", [notificationId, title, status, staff.id]);
      await connection.query("INSERT INTO portal_notification_recipients_v2(notification_id,account_id) VALUES ($1,$2)", [notificationId, accountId]);
    }
    const notices = await (await request(`/${dealerA.id}/portal-v2/notifications`)).json() as { notifications: { notification: { title: string }; recipient: { readAt: string | null } }[] };
    assert.deepEqual(notices.notifications.map(x => x.notification.title), ["Sent A"]);
    assert.equal(notices.notifications[0].recipient.readAt, null);
    assert.equal((await connection.query("SELECT status FROM portal_notifications_v2 WHERE title='Scheduled notice'")).rows[0].status, "scheduled");
    const bookId = randomUUID();
    await connection.query("INSERT INTO pricebooks(id,catalog_release_id,version,source_name,provenance,effective_from,snapshot,snapshot_sha256,approved_at) VALUES ($1,$2,'test-version','Test fixture','{}',current_date,'{}','test-only',now())", [bookId, randomUUID()]);
    await connection.query("INSERT INTO pricebook_lines(pricebook_id,sku,currency,wholesale_amount,status,source_record) VALUES ($1,'TEST-ONLY-SKU','USD',100,'priced','{}')", [bookId]);
    await connection.query("INSERT INTO portal_price_overrides(account_id,sku,wholesale_amount) VALUES ($1,'TEST-ONLY-SKU',75)", [dealerA.id]);
    for (const [dealer, amount] of [[dealerA, "75.00"], [dealerB, "100.00"]] as const) {
      const response = await request(`/${dealer.id}/dealer-portal/pricing`);
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { wholesaleAmount: string }[])[0].wholesaleAmount, amount);
    }
    const bootstrapResponse = await request(`/${dealerA.id}/portal-v2/bootstrap`);
    const bootstrapText = await bootstrapResponse.text();
    for (const secret of ["clerkUserId", "assignedRepId", "authorizedClerkUserId", "createdByAccountId", staff.clerkUserId, staff.email, manager.id, manager.clerkUserId]) assert.equal(bootstrapText.includes(secret), false);
    const bootstrap = JSON.parse(bootstrapText) as { role: string; account: { id: string; assignedRep: unknown }; authorized: boolean };
    assert.deepEqual(bootstrap.account.assignedRep, { email: manager.email, displayName: manager.displayName });
    assert.equal(bootstrap.role, "dealer");
    assert.equal(bootstrap.account.id, dealerA.id);
    assert.equal(bootstrap.authorized, true);
    const audit = await connection.query("SELECT actor_account_id,target_id FROM audit_events WHERE action='portal.dealer_view.opened'");
    assert.equal(audit.rows[0].actor_account_id, staff.id);
    assert.equal(audit.rows[0].target_id, dealerA.id);
    const accesses = await connection.query("SELECT actor_account_id,target_id,metadata,created_at FROM audit_events WHERE action='portal.dealer_view.data.accessed'");
    assert.ok(accesses.rows.length >= 5);
    for (const access of accesses.rows) {
      assert.equal(access.actor_account_id, staff.id);
      assert.ok([dealerA.id, dealerB.id].includes(access.target_id));
      assert.equal(access.metadata.readOnly, true);
      assert.ok(access.metadata.dataAccess.startsWith("/"));
      assert.ok(!Number.isNaN(Date.parse(access.metadata.accessedAt)));
    }
    assert.equal(observedActors.at(-1), staff.id);
    assert.deepEqual((await db.select().from(accountsTable).where(eq(accountsTable.id, dealerA.id)))[0].lastSeenAt, dealerA.lastSeenAt);
    const callsBeforeWrites = authenticationCalls;
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) assert.equal((await request(`/${dealerA.id}/portal-v2/content`, staff.id, method)).status, 403);
    for (const path of [`/${dealerA.id}/portal-v2/notifications/${randomUUID()}/read`, `/${dealerA.id}/dealer-portal/forms/${randomUUID()}/submissions`, `/${dealerA.id}/dealer-portal/push-subscriptions`, ""]) {
      assert.equal((await request(path, staff.id, "POST")).status, 403);
    }
    assert.equal(authenticationCalls, callsBeforeWrites);
    const recipientState = await connection.query("SELECT read_at,acknowledged_at FROM portal_notification_recipients_v2");
    assert.ok(recipientState.rows.every(row => row.read_at === null && row.acknowledged_at === null));
    for (const path of ["/portal-v2/admin/content", "/staff/portal/users", "/portal-v2/content/extra", "/account"]) assert.equal((await request(`/${dealerA.id}${path}`)).status, 403);
    assert.equal(isDealerPreviewRead("GET", "/portal-v2/admin/content"), false);
    assert.equal((await request("/not-a-uuid/portal-v2/content")).status, 403);
    assert.equal((await request(`/${dealerA.id}/portal-v2/content?accountId=${dealerB.id}`)).status, 400);
    await connection.query("INSERT INTO portal_access_rules(subject_type,account_id,capability,enabled) VALUES ('account',$1,'page:resources',false)", [dealerA.id]);
    assert.deepEqual(await titles(dealerA.id), []);
    assert.equal((await request(`/${dealerA.id}/dealer-portal/resources`)).status, 403);
    for (const [table, column, value] of [["organization_memberships", "account_id", dealerA.id], ["dealer_organizations", "id", orgId], ["accounts", "id", dealerA.id]]) {
      await connection.query(`UPDATE ${table} SET status='suspended' WHERE ${column}=$1`, [value]);
      assert.equal((await request(`/${dealerA.id}/portal-v2/content`)).status, 403);
      await connection.query(`UPDATE ${table} SET status='approved' WHERE ${column}=$1`, [value]);
    }
    const own = (path: string, accountId: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api/own-portal${path}`, { method, headers: { "x-test-account": accountId, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    // Staff access is their own authenticated context, without fake dealer memberships.
    for (const actor of [staff, manager, sales, owner]) {
      await connection.query("INSERT INTO portal_access_rules(subject_type,account_id,capability,enabled) VALUES ('account',$1,'page:resources',false)", [actor.id]);
      const contentResponse = await own("/portal-v2/content?kind=resource", actor.id);
      assert.equal(contentResponse.status, 200);
      const ownContent = await contentResponse.json() as { content: { title: string }[] };
      assert.ok(ownContent.content.some(row => row.title === "Dealer B only"));
      assert.ok(ownContent.content.some(row => row.title === "Group only"));
      assert.ok(!ownContent.content.some(row => row.title === "Draft secret"));
      const resources = await own("/dealer-portal/resources", actor.id);
      assert.equal(resources.status, 200);
      assert.ok((await resources.text()).includes("Dealer B document"));
      for (const path of ["/dealer-portal/dashboard", "/dealer-portal/forms", "/dealer-portal/pricing", "/dealer-portal/access", "/portal-v2/projects", "/portal-v2/notification-preferences"]) assert.equal((await own(path, actor.id)).status, 200, path);
      const preferences = await own("/portal-v2/notification-preferences", actor.id, "PUT", { pushEnabled: false });
      assert.equal(preferences.status, 200);
      assert.equal((await preferences.json() as { preferences: { accountId: string } }).preferences.accountId, actor.id);
    }
    for (const path of ["/portal-v2/content", "/dealer-portal/resources", "/dealer-portal/dashboard"]) assert.equal((await own(path, unclaimed.id)).status, 403);
    await connection.query("UPDATE accounts SET status='suspended' WHERE id=$1", [sales.id]);
    assert.equal((await own("/portal-v2/content", sales.id)).status, 403);
    await connection.query("UPDATE portal_staff_profiles SET authorized_at=NULL WHERE account_id=$1", [staff.id]);
    assert.equal((await request(`/${dealerA.id}/portal-v2/content`)).status, 403);
    assert.equal((await own("/portal-v2/content", staff.id)).status, 403);
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    queryMock?.mock.restore();
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  }
});
