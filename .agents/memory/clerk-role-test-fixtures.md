---
name: Clerk role test fixtures
description: Avoid misleading authorization failures when browser tests provision disposable staff or dealer accounts.
---

For authenticated development tests, bind fixtures to the exact account returned
by the current browser session's `/api/account`, not an assumed email match.
Changing a disposable account's persisted role does not invalidate an already
mounted browser's account or portal-session cache.

**Why:** Browser verification has observed stale customer state after a valid
staff/dealer fixture assignment. It can look like a backend authorization failure
even when the authenticated API recognizes the new role.

**How to apply:** After provisioning only a disposable fixture, compare the
session's account identity and bootstrap role with the fixture before testing
privileged flows. Reload and allow Clerk session propagation; do not continuously
retry or weaken guards/rate limits. Any frontend redirect loop is still a real
application bug and must fail safely rather than flood account requests.