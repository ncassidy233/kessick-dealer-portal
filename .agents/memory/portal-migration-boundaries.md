---
name: Portal migration authorization boundaries
description: Security constraints when old dealer APIs coexist with newer staff-managed content and roles.
---

Treat linked legacy content as governed by its newer targeting record even when that record is unpublished or deleted. Removing a mapping must never restore legacy default visibility.

**Why:** Security review during the portal expansion found that filtering mappings to published records made an unpublished item look unmapped, reopening access. Deleting a linked price book had the same risk.

**How to apply:** When changing content lifecycle or migrating routes, check old list, file download, form submit, and price-book paths together. Keep denial effective across both APIs, including after unpublish/delete and group changes.

Allowlist bootstrap and regular authentication are different operations; verified sign-in must not undo a staff role change or revocation.

**Why:** The user requested no-code staff management after an earlier allowlist-only model. Reapplying bootstrap grants on every login would make those management controls ineffective.

**How to apply:** Preserve one-time bootstrap behavior while making subsequent staff changes authoritative. Test revocation across a new request or sign-in, not only the account-update response.