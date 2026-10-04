---
name: Legacy claim retries
description: Safe retry rule for interrupted local-to-cloud project claims.
---

An interrupted legacy claim must resume from the current cloud snapshot and change only fields owned by the migration. Never submit the full old local snapshot again after a cloud project exists.

**Why:** Fetching the latest version and then pairing it with an old local snapshot defeats optimistic concurrency and can silently overwrite edits made after the first claim attempt.

**How to apply:** Reuse the idempotent cloud project, detect independently changed migration targets, merge the durable image reference into the returned current snapshot, and mark the local claim complete only after verifying the committed reference.