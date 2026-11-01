# Production security and operator checklist

## Deployment

The production portal and API run as separate Render services from the deployment branch. Deploy coordinated changes to both and verify their exact commit and health. Local fixes are not live until that deployment succeeds.

The portal and concept video's production artifacts use `scripts/serve-secure-static.mjs` to serve only compiled public directories. This supplies CSP, no-index, frame/sniff/referrer/permissions protection, and HSTS on actual HTML responses, not only the API. Development remains Vite-based. Camera and XR permissions remain same-origin; external HTTPS reference images are supported. No inline JavaScript or unsafe-eval is permitted by the production static CSP.

## Required configuration

- Keep database, Clerk, provider, storage, session-signing, and VAPID private credentials in Render environment secrets. Never put secret values in VITE-prefixed variables.
- Existing Clerk configuration is retained. Use the managed authentication configuration to review MFA, session lifetime, and production login providers. Do not replace Clerk's cookie behavior manually.
- `SESSION_SECRET` must be a high-entropy secret of at least 32 characters and identical across replicas. It signs short-lived resource upload intents; missing/invalid configuration disables those uploads with an explicit setup error. Rotation invalidates outstanding intents.
- `KESSICK_ALLOWED_ORIGINS` must include each exact intended HTTPS production origin when not supplied by the runtime domain configuration. Do not add wildcards or arbitrary tenant-supplied origins.
- Web Push requires a valid matching VAPID key pair and a valid contact subject (`mailto:` address or HTTPS URL). Invalid configuration disables push, not the API. Verify a real device before announcing delivery.
- AI integrations still require their actual provider configuration. No substitute login or fabricated AI result was introduced.

## Access and file behavior

- Staff permissions come from approved, persisted, Clerk-bound roles. An email environment allowlist no longer grants privileges.
- Project access, wholesale pricing, administration, and AI actions retain server-side permission checks. Content managers do not receive cross-organization project access.
- New upload types: JPEG, PNG, WebP; staff resources may additionally use structurally checked PDFs and UTF-8 plain text. Office/ZIP/executable files are rejected explicitly. Existing stored resource downloads are not deleted.
- Images have byte and decoded-pixel limits and are re-encoded before publication. PDFs containing active actions, embedded content, encryption, or unsupported structure are rejected; export a flattened, non-interactive PDF if necessary.
- Upload intents bind actor/path/type/size/expiry; transport enforces exact length, and object writes/finalization are generation-pinned and create-only. Resource intents are signed rather than process-local, so they work across Autoscale instances.
- Upload/download requests must preserve credentials and the CSRF marker used by the updated clients. External integrations should follow their supported OAuth/bearer protocol rather than borrowing browser cookies.

## Remaining operational work

- Publish the coordinated build, then verify real production login, private photo/resource uploads, OAuth clients, and required origin settings.
- Rate limits are enforced per IP and authenticated account in each process. A shared distributed limiter remains recommended for strict aggregate limits across Autoscale replicas; current limits are not a fleet-wide spending guarantee.
- Review database TLS/least-privilege grants and backup/restore policy with the database owner; this hardening does not rewrite infrastructure grants.
- Restrict production log access and retention. Security rejections are recorded without request bodies or credential values.
- Perform ongoing dependency audits and authenticated cross-tenant regression testing. No application can be declared permanently vulnerability-free.

## Verification commands

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/kessick-visualizer exec tsx --test src/lib/csv-safety.test.ts
node --test scripts/serve-secure-static.test.mjs
pnpm audit --json
pnpm --filter @workspace/api-server run build
PORT=23780 BASE_PATH=/ pnpm --filter @workspace/kessick-visualizer run build
PORT=21455 BASE_PATH=/kessick-concept-video/ pnpm --filter @workspace/kessick-concept-video run build
```
## Staff boundary sweep — November 1, 2026

- Every `/api/staff` and `/api/portal-v2/admin` route now passes a central deny-by-default boundary before route handlers, including future modules. It checks an approved staff account and a persisted role bound to the authenticated Clerk identity. Individual capabilities are still enforced inside each module. Dealer roles, role hints in headers/query strings, unclaimed profiles, mismatched identities, suspended users and revoked staff are denied.
- Staff UI access fails closed on account or permission-refresh failures, even with cached data. Permission checks refresh every 30 seconds in active tabs and on focus/reconnect. Every privileged API call checks current server permissions independently of that interval. Switching identities creates a separate query cache.
- JSON/form parsers reject compressed bodies. A bounded iterative payload check rejects excessive nesting or node counts before authentication-provider/schema/database work. Existing upload MIME, file-structure, size, pixel, signed-intent and ownership checks remain enforced.
- API and static responses prohibit HTML base elements and add cross-origin opener/resource isolation while retaining the popup behavior needed by managed sign-in. Existing TLS/HSTS, CSP, no-sniff, frame blocking, no-store, exact origins, CSRF and rate limits remain.
- Dependency updates and lockfile overrides remediate the audit findings in both application and build-time dependencies. Re-run registry audits regularly; a clean result is time-specific and not proof of absence of vulnerabilities.
- Verification uses a disposable database, synthetic identities and benign local malicious-file fixtures. It does not run destructive attacks or malware against production.

### Operational limits requiring verification

This is application hardening, not a guarantee against ransomware or every cyber risk. The live managed sign-in previously displayed Clerk development mode; a production Clerk instance and staff MFA require separate configuration and recovery testing. Database network restrictions are retained. The owner must verify independent/immutable backups, retention and a successful restore; no restore test or new backup service was performed in this sweep. Provider accounts, administrator devices, incident alerting, credential recovery and independent penetration testing remain part of operational security. Do not describe these as verified or claim the portal is 100% secure.

## Staff-created dealer invitations

Staff with `users:write` approve dealer access by adding the exact email address. The account, organization and membership are committed before invitation delivery. Existing applicants retain their identity and organization while receiving approval; suspended accounts, suspended memberships, suspended organizations, staff accounts and conflicting organization assignments are rejected. Email verification remains required when the invited placeholder is claimed.

Invitation delivery is reported separately as submitted, failed or unnecessary for an existing sign-in account. A mail failure leaves the authorized account saved and provides a normal sign-in link; it never reports successful delivery. Public signups still follow the application review process.

At startup, the repair checks old pending dealer accounts against staff provisioning audit records. It excludes later explicit status changes, public applications and suspended access. Repairs are transactional, idempotent and audited. This does not grant staff roles or change existing Clerk identity bindings.

The Clerk application name was changed to Kessick Dealer Portal in the provider dashboard. Production sender-domain authentication and inbox placement remain operational work. Marking a message as not spam in one mailbox does not verify deliverability for every dealer.

The November 1 logical backup was restored into an isolated PostgreSQL-compatible engine: 45 tables, 32 rows and 76 foreign-key constraints, with no invalid constraints. Render showed three days of point-in-time recovery and seven days of logical export retention. This was not a full Render PITR failover drill or verification of independent immutable backups.
