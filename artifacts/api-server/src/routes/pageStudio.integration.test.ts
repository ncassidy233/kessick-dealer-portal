import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { drizzle } from "drizzle-orm/node-postgres";

test("Page Studio persists independent drafts with staff permissions and optimistic conflict protection", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async t => {
  const { db, pool, accountsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { default: router } = await import("./pageStudio");
  const connection = await pool.connect();
  const rollback = new Error("Roll back isolated Page Studio fixtures");
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    await drizzle(connection).transaction(async transaction => {
      for (const table of ["accounts", "portal_staff_profiles", "dealer_organizations", "organization_memberships",
        "portal_group_assignments", "portal_group_memberships_v2", "portal_access_rules",
        "portal_page_drafts", "portal_page_publications", "audit_events"]) {
        await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP`);
      }
      const queries = t.mock.method(pool, "query", connection.query.bind(connection));
      const transactions = t.mock.method(db, "transaction", transaction.transaction.bind(transaction));
      try {
        const [staff, dealer, sales, customer] = await db.insert(accountsTable).values(
          (["staff", "dealer", "staff", "customer"] as const).map(role => ({ id: randomUUID(), clerkUserId: `test_${randomUUID()}`, email: `${randomUUID()}@example.invalid`, role, status: "approved" as const })),
        ).returning();
        for (const [account, role] of [[staff, "content_manager"], [sales, "sales_rep"]] as const) {
          await connection.query("INSERT INTO portal_staff_profiles(account_id,role,authorized_at,authorized_clerk_user_id) VALUES ($1,$2,now(),$3)", [account.id, role, account.clerkUserId]);
        }
        const orgId = randomUUID();
        await connection.query("INSERT INTO dealer_organizations(id,name,slug,status,created_by_account_id) VALUES ($1,'Test org',$2,'approved',$3)", [orgId, randomUUID(), staff.id]);
        await connection.query("INSERT INTO organization_memberships(organization_id,account_id,status) VALUES ($1,$2,'approved')", [orgId, dealer.id]);
        const app = express();
        app.use(express.json(), async (req, res, next) => {
          const id = req.header("x-test-account");
          if (!id) { res.status(401).end(); return; }
          [req.account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
          next();
        }, router);
        server = app.listen(0, "127.0.0.1");
        await new Promise<void>(resolve => server!.once("listening", resolve));
        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const request = (path: string, accountId = staff.id, body?: unknown) => fetch(`http://127.0.0.1:${address.port}${path}`, {
          method: body ? "PUT" : "GET",
          headers: { "x-test-account": accountId, "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const document = { schemaVersion: 1, title: "Draft home", sections: [{ id: randomUUID(), type: "text", heading: "Draft only", body: "Unpublished text", background: "dark", spacing: "comfortable" }] };
        const save = (revision: number, title = "Draft home", accountId = staff.id) => request("/admin/pages/home/draft", accountId, { expectedRevision: revision, document: { ...document, title } });
        assert.equal((await request("/admin/pages/home/draft", dealer.id)).status, 403);
        assert.equal((await save(0, "Denied dealer", dealer.id)).status, 403);
        assert.equal((await save(0, "Denied sales", sales.id)).status, 403);
        const saved = await save(0);
        assert.equal(saved.status, 200);
        assert.equal((await saved.json() as { draft: { revision: number } }).draft.revision, 1);
        assert.equal((await save(0)).status, 409);
        assert.equal((await request("/pages/home", dealer.id)).status, 404);
        assert.equal((await request("/pages/home", customer.id)).status, 403);
        const publishedDocument = { ...document, title: "Published home" };
        await connection.query("INSERT INTO portal_page_publications(page_key,document,revision,published_by_account_id) VALUES ('home',$1,1,$2)", [JSON.stringify(publishedDocument), staff.id]);
        assert.equal((await save(1, "Newer unpublished home")).status, 200);
        const published = await (await request("/pages/home", dealer.id)).json() as { page: { document: { title: string }; revision: number } };
        assert.equal(published.page.document.title, "Published home");
        assert.equal(published.page.revision, 1);
        const persisted = await (await request("/admin/pages/home/draft")).json() as { draft: { document: { title: string }; updatedByAccountId: string; revision: number } };
        assert.equal(persisted.draft.document.title, "Newer unpublished home");
        assert.equal(persisted.draft.updatedByAccountId, staff.id);
        const outcomes = [await save(2, "Editor A"), await save(2, "Editor B")];
        assert.deepEqual(outcomes.map(x => x.status).sort(), [200, 409]);
        assert.equal((await request("/admin/pages/account/draft", staff.id, { expectedRevision: 0, document })).status, 400);
        assert.equal((await request("/admin/pages/home/draft", staff.id, { expectedRevision: 3, document: { ...document, script: "unsafe" } })).status, 400);
        await connection.query("INSERT INTO portal_page_publications(page_key,document,revision,published_by_account_id) VALUES ('resources',$1,1,$2)", [JSON.stringify(publishedDocument), staff.id]);
        await connection.query("INSERT INTO portal_access_rules(subject_type,account_id,capability,enabled) VALUES ('account',$1,'page:resources',false)", [dealer.id]);
        assert.equal((await request("/pages/resources", dealer.id)).status, 403);
        await connection.query("UPDATE organization_memberships SET status='suspended' WHERE account_id=$1", [dealer.id]);
        assert.equal((await request("/pages/home", dealer.id)).status, 403);
        await connection.query("UPDATE portal_staff_profiles SET authorized_at=NULL WHERE account_id=$1", [staff.id]);
        assert.equal((await save(3)).status, 403);
        assert.equal((await connection.query("SELECT count(*) FROM audit_events WHERE action='page_studio.draft.saved'")).rows[0].count, "3");
      } finally {
        if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
        queries.mock.restore();
        transactions.mock.restore();
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    connection.release();
    await pool.end();
  }
});
