import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { filterAuthorizedCitations } from "./conciergeSafety";

// Explicit development opt-in. No auth mocks: only the DB transport is pinned
// to one transaction whose temporary tables shadow the production table names.
test("actual knowledge SQL and persisted role joins isolate lifecycle/audiences", {
  skip: process.env.KNOWLEDGE_DB_INTEGRATION_TEST !== "1" || process.env.NODE_ENV === "production" || !process.env.DATABASE_URL,
}, async (t) => {
  const { db, pool, accountsTable } = await import("@workspace/db");
  const { retrieveKnowledge, currentKnowledgeSources } = await import("./knowledgeRetrieval");
  const connection = await pool.connect();
  let queryMock: ReturnType<typeof t.mock.method> | undefined;
  try {
    await connection.query("BEGIN");
    for (const table of ["accounts", "portal_staff_profiles", "dealer_organizations", "organization_memberships", "concierge_knowledge"]) {
      // Identifiers are a hard-coded allowlist, not request/user input.
      await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
    }
    queryMock = t.mock.method(pool, "query", connection.query.bind(connection));
    const [staff, dealer, customer] = await db.insert(accountsTable).values(
      (["staff", "dealer", "customer"] as const).map(role => ({
        id: randomUUID(), clerkUserId: `test_${role}_${randomUUID()}`,
        email: `${role}-${randomUUID()}@example.invalid`, role, status: "approved" as const,
      })),
    ).returning();
    const orgId = randomUUID();
    await connection.query(
      "INSERT INTO portal_staff_profiles(account_id,role,authorized_at,authorized_clerk_user_id) VALUES ($1,'content_manager',now(),$2)",
      [staff.id, staff.clerkUserId],
    );
    await connection.query(
      "INSERT INTO dealer_organizations(id,name,slug,status,created_by_account_id) VALUES ($1,'Test organization',$2,'approved',$3)",
      [orgId, randomUUID(), staff.id],
    );
    await connection.query(
      "INSERT INTO organization_memberships(organization_id,account_id,status) VALUES ($1,$2,'approved')",
      [orgId, dealer.id],
    );
    const definitions = [
      { audience: "staff", status: "active", deleted: false, text: "regressioncabinet staff-only dimension is 47 inches." },
      { audience: "approved_dealers", status: "active", deleted: false, text: "regressioncabinet dealer care uses a dry cloth." },
      { audience: "approved_dealers", status: "review", deleted: false, text: "regressioncabinet unreviewed secret." },
      { audience: "approved_dealers", status: "archived", deleted: false, text: "regressioncabinet archived secret." },
      { audience: "approved_dealers", status: "active", deleted: true, text: "regressioncabinet deleted secret." },
    ].map(row => ({ ...row, id: randomUUID() }));
    for (const row of definitions) {
      await connection.query(
        `INSERT INTO concierge_knowledge(id,title,file_name,content_type,byte_size,object_path,extracted_text,audience,status,deleted_at,created_by_account_id)
         VALUES ($1,'Test knowledge','test.txt','text/plain',100,'/private-test-not-an-object',$2,$3,$4,$5,$6)`,
        [row.id, row.text, row.audience, row.status, row.deleted ? new Date() : null, staff.id],
      );
    }
    const staffReq = { account: staff } as Request;
    const dealerReq = { account: dealer } as Request;
    const customerReq = { account: customer } as Request;
    const customerOAuthReq = { account: customer, conciergeScopes: ["concierge:ask", "catalog:read"], conciergeConnectionId: randomUUID() } as Request;
    const sourceIds = definitions.map(row => `knowledge:${row.id}:0`);
    const ids = (sources: Awaited<ReturnType<typeof retrieveKnowledge>>) => sources.map(s => s.sourceId).sort();
    assert.deepEqual(ids(await retrieveKnowledge(staffReq, "regressioncabinet")), sourceIds.slice(0, 2).sort());
    assert.deepEqual(ids(await retrieveKnowledge(dealerReq, "regressioncabinet")), [sourceIds[1]]);
    for (const req of [customerReq, customerOAuthReq]) {
      assert.deepEqual(await retrieveKnowledge(req, "regressioncabinet"), []);
      assert.equal((await currentKnowledgeSources(req, sourceIds)).size, 0);
    }
    const staffSources = await currentKnowledgeSources(staffReq, sourceIds);
    assert.deepEqual([...staffSources.keys()].sort(), sourceIds.slice(0, 2).sort());
    assert.equal(staffSources.get(sourceIds[0]), definitions[0].text);
    assert.deepEqual(filterAuthorizedCitations([{ sourceId: sourceIds[0], quote: definitions[0].text }], staffSources),
      [{ sourceId: sourceIds[0], quote: definitions[0].text }]);
    const dealerSources = await currentKnowledgeSources(dealerReq, sourceIds);
    assert.deepEqual([...dealerSources.keys()], [sourceIds[1]]);
    assert.deepEqual(filterAuthorizedCitations([{ sourceId: sourceIds[0], quote: definitions[0].text }], dealerSources), []);
    assert.deepEqual(filterAuthorizedCitations([{ sourceId: sourceIds[1], quote: "invented engineering approval" }], dealerSources), []);

    // Real persisted membership/org/account joins, rather than a role-only helper.
    for (const table of ["organization_memberships", "dealer_organizations", "accounts"]) {
      const idColumn = table === "organization_memberships" ? "account_id" : "id";
      const id = table === "dealer_organizations" ? orgId : dealer.id;
      await connection.query(`UPDATE ${table} SET status = 'suspended' WHERE ${idColumn} = $1`, [id]);
      assert.deepEqual(await retrieveKnowledge(dealerReq, "regressioncabinet"), []);
      assert.equal((await currentKnowledgeSources(dealerReq, sourceIds)).size, 0);
      await connection.query(`UPDATE ${table} SET status = 'approved' WHERE ${idColumn} = $1`, [id]);
    }
    const mismatchedStaff = { account: { ...staff, clerkUserId: "wrong_clerk_identity" } } as Request;
    assert.deepEqual(await retrieveKnowledge(mismatchedStaff, "regressioncabinet"), []);
    await connection.query("UPDATE portal_staff_profiles SET authorized_at = NULL WHERE account_id = $1", [staff.id]);
    assert.equal((await currentKnowledgeSources(staffReq, sourceIds)).size, 0);
    await connection.query("UPDATE portal_staff_profiles SET authorized_at = now() WHERE account_id = $1", [staff.id]);

    // Changing eligibility after retrieval immediately removes historical citations.
    for (const mutation of ["status = 'review'", "status = 'archived'", "deleted_at = now()", "audience = 'staff'"]) {
      await connection.query(`UPDATE concierge_knowledge SET ${mutation} WHERE id = $1`, [definitions[1].id]);
      assert.deepEqual(await retrieveKnowledge(dealerReq, "regressioncabinet"), []);
      assert.equal((await currentKnowledgeSources(dealerReq, [sourceIds[1]])).size, 0);
      await connection.query("UPDATE concierge_knowledge SET status = 'active', deleted_at = NULL, audience = 'approved_dealers' WHERE id = $1", [definitions[1].id]);
    }
  } finally {
    queryMock?.mock.restore();
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  }
});