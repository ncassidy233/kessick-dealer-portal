# Production security and operator checklist

## Deployment

Security changes in the workspace are not applied to the existing public deployment until the owner republishes. Build and publish the portal and API together: the upload protocol changed from signed direct-storage PUTs to authenticated same-origin bounded PUTs.

The portal and concept video's production artifacts use `scripts/serve-secure-static.mjs` to serve only compiled public directories. This supplies CSP, no-index, frame/sniff/referrer/permissions protection, and HSTS on actual HTML responses, not only the API. Development remains Vite-based. Camera and XR permissions remain same-origin; external HTTPS reference images are supported. No inline JavaScript or unsafe-eval is permitted by the production static CSP.

## Required configuration

- Keep database, Clerk, provider, storage, session-signing, and VAPID private credentials in Replit Secrets. Never put secret values in VITE-prefixed variables.
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