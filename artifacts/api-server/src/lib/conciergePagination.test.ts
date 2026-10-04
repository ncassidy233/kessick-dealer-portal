import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeConciergeCursor,
  decodeMessageCursor,
  paginateMessageRows,
  paginateNewestFirst,
} from "./conciergePagination";

const rows = [
  {
    id: "00000000-0000-4000-8000-000000000003",
    at: new Date("2026-01-03T00:00:00.000Z"),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    at: new Date("2026-01-02T00:00:00.000Z"),
  },
  {
    id: "00000000-0000-4000-8000-000000000001",
    at: new Date("2026-01-01T00:00:00.000Z"),
  },
];

test("returns the newest conversation page with an exclusive older cursor", () => {
  const page = paginateNewestFirst(
    rows,
    2,
    (row) => row.at,
    (row) => row.id,
  );
  assert.deepEqual(page.items, rows.slice(0, 2));
  assert.deepEqual(decodeConciergeCursor(page.nextCursor!), {
    at: rows[1].at,
    id: rows[1].id,
  });
});

test("returns message pages chronologically while cursoring from the oldest item", () => {
  const messageRows = [
    { role: "assistant", orderIndex: 3 },
    { role: "assistant", orderIndex: 2 },
    { role: "user", orderIndex: 1 },
  ];
  const page = paginateMessageRows(
    messageRows,
    2,
    (row) => row.orderIndex,
  );
  assert.deepEqual(page.items, [messageRows[1], messageRows[0]]);
  assert.equal(decodeMessageCursor(page.nextCursor!), 2);
});

test("message insertion order keeps an answer after its tied-timestamp question", () => {
  const tiedRows = [
    { role: "assistant", orderIndex: 2, createdAt: rows[0].at },
    { role: "user", orderIndex: 1, createdAt: rows[0].at },
  ];
  const first = paginateMessageRows(tiedRows, 1, (row) => row.orderIndex);
  const cursor = decodeMessageCursor(first.nextCursor!)!;
  const remaining = tiedRows.filter((row) => row.orderIndex < cursor);
  const second = paginateMessageRows(remaining, 1, (row) => row.orderIndex);
  assert.equal(second.items[0].role, "user");
  assert.equal(first.items[0].role, "assistant");
});