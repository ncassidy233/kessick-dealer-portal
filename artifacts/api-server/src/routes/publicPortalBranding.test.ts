import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { defaultPortalPublicBranding } from "@workspace/api-zod";

test("anonymous branding reads only the publication and never expose drafts or dealer metadata", async t => {
  // No database connection is opened: every select is replaced with an isolated fixture.
  process.env.DATABASE_URL ??= "postgresql://unused:unused@127.0.0.1:1/unused";
  const { db, pool, portalPagePublicationsTable, portalPageDraftsTable } = await import("@workspace/db");
  let published: unknown = { ...defaultPortalPublicBranding, signInTitle: "Published sign-in" };
  const draft = { ...defaultPortalPublicBranding, signInTitle: "Private unsaved title" };
  const tables: unknown[] = [];
  const select = t.mock.method(db, "select", (() => ({
    from: (table: unknown) => {
      tables.push(table);
      return { where: async () => table === portalPageDraftsTable ? [{ branding: draft }] : published === undefined ? [] : [{ branding: published, actorAccountId: "private actor", document: { sections: ["private dealer content"] } }] };
    },
  })) as unknown as typeof db.select);
  const { default: router } = await import("./publicPortalBranding");
  const app = express().use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/public/portal-branding`;
  try {
    const response = await fetch(endpoint);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { branding: published });
    assert.equal(tables[0], portalPagePublicationsTable);
    assert.equal(tables.includes(portalPageDraftsTable), false);
    published = undefined;
    assert.deepEqual(await (await fetch(endpoint)).json(), { branding: null });
    published = { ...defaultPortalPublicBranding, sections: ["must not leak"] };
    assert.deepEqual(await (await fetch(endpoint)).json(), { branding: null });
    assert.equal((await fetch(endpoint, { method: "POST", body: JSON.stringify({ branding: draft }), headers: { "Content-Type": "application/json" } })).status, 404);
    assert.ok(tables.every(table => table === portalPagePublicationsTable));
  } finally {
    select.mock.restore();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
