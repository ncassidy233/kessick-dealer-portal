import assert from "node:assert/strict";
import test from "node:test";

test("activation snapshot rejects a concurrent edit without losing PostgreSQL microseconds", { skip: !process.env.DATABASE_URL }, async () => {
  const { pool } = await import("@workspace/db");
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    // Transaction-local fixture only; no application/user records are modified.
    await connection.query("CREATE TEMP TABLE knowledge_cas_test (status text, updated_at timestamptz) ON COMMIT DROP");
    await connection.query("INSERT INTO knowledge_cas_test VALUES ('review', '2026-01-01 00:00:00.123456+00')");
    const initial = (await connection.query("SELECT updated_at::text AS version FROM knowledge_cas_test")).rows[0].version;
    await connection.query("UPDATE knowledge_cas_test SET updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')");
    const stale = await connection.query("UPDATE knowledge_cas_test SET status = 'active' WHERE status = 'review' AND updated_at = $1::timestamptz", [initial]);
    assert.equal(stale.rowCount, 0);
    const fresh = (await connection.query("SELECT updated_at::text AS version FROM knowledge_cas_test")).rows[0].version;
    const activated = await connection.query("UPDATE knowledge_cas_test SET status = 'active' WHERE status = 'review' AND updated_at = $1::timestamptz", [fresh]);
    assert.equal(activated.rowCount, 1);
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  }
});