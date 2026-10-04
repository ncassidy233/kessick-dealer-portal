---
name: ORM JSON input boundaries
description: Null-prototype validation maps can fail Drizzle entity inspection before a query reaches PostgreSQL.
---

Keep prototype-safe validation, but normalize sanitized answer maps to ordinary
objects before giving them to Drizzle as JSONB values. Continue rejecting
prototype-related field keys.

**Why:** Drizzle's entity inspection assumes a constructor-bearing prototype.
A null-prototype map passed helper tests but caused an insert-time TypeError
before any SQL ran.

**How to apply:** When changing JSON-valued writes, include an actual ORM insert
compilation (`toSQL`) check, not only pure validation tests. This catches adapter
boundary failures without mutating a database.