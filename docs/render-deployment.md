# Render deployment

The Render blueprint defines three separate services:

- `kessick-dealer-portal`: the authenticated React app, built with
  `vite.production.config.ts` and served with the repository's secure static
  server. It proxies `/api/*` to the API service so Clerk cookies, CSRF checks,
  and browser requests stay same-origin.
- `kessick-dealer-api`: the Express API, built from only the API workspace and
  served independently.
- `kessick-dealer-preview`: the isolated, sample-only static preview. Its build
  command and publish directory are intentionally separate from the real app:

  ```sh
  pnpm install --frozen-lockfile && pnpm --filter @workspace/kessick-visualizer exec vite build --config vite.render.config.ts
  ```

  Publish directory: `artifacts/kessick-visualizer/dist/render-preview`

The sample preview does not use Clerk, API data, or private dealer records. A
successful preview deployment is not a production app deployment.

## Provision services and configuration

1. Provision a PostgreSQL database and Google Cloud Storage buckets in accounts
   owned by Kessick. Use TLS for PostgreSQL and a dedicated, least-privilege GCP
   service account. Do not point this deployment at production data until its
   owner has approved the migration and backup plan.
2. Create or review the Render services from `/render.yaml`. Use persistent
   production instances; do not use ephemeral/free instances for the API if
   production availability is required.
3. On the `kessick-dealer-portal` service, set:
   - `API_ORIGIN`: the API service's HTTPS origin, e.g.
     `https://kessick-dealer-api.onrender.com` (origin only; no path).
   - `VITE_CLERK_PUBLISHABLE_KEY`: the production Clerk publishable key. Vite
     embeds this public key into the browser bundle at build time.
   - `VITE_CLERK_PROXY_URL`: `/api/__clerk`, routed through the same-origin API
     proxy. Rebuild after changing the publishable key or proxy URL.
4. On `kessick-dealer-api`, set:
   - `DATABASE_URL`: the TLS-enabled PostgreSQL connection string.
   - `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`: matching production Clerk
     credentials. Configure the Clerk production application and allowed
     frontend domain before enabling dealer sign-in.
   - `KESSICK_ALLOWED_ORIGINS`: the exact portal HTTPS origin (no wildcard), for
     example `https://portal.example.com`. Include any additional trusted
     origins only when they are intentionally used.
   - `SESSION_SECRET`: a high-entropy secret of at least 32 characters.
   - `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS`: the existing
     slash-prefixed GCS bucket paths expected by the application. The service
     account needs access to those buckets.
   - `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS`: the project
     ID and path to a Render secret file containing the service-account JSON.
     Keep the file out of Git and do not put credential JSON in a
     `VITE_`-prefixed variable. The storage client uses Google Application
     Default Credentials when either setting is present; without them it
     retains the Replit sidecar credentials for Replit deployments.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` only if Web
     Push is configured. Use a matching key pair and a valid contact subject.
   - `AI_INTEGRATIONS_OPENAI_BASE_URL` and
     `AI_INTEGRATIONS_OPENAI_API_KEY` only if the Concierge AI integration is
     configured. These credentials are not required for the core portal.

Render supplies `PORT` to both Node services. Do not set it to a fixed value.
The frontend listens on `PORT`; its `/api` requests are forwarded to
`API_ORIGIN`. The API health check is `/healthz`.

## Database release procedure

Back up the database and compare it with `lib/db/src/schema/` before deployment.
Apply reviewed schema changes through the database owner's migration process;
do not use `drizzle-kit push --force` against production. The additive
`lib/db/migrations/20260603_concierge_knowledge.sql` migration is required only
for Concierge knowledge features, and its production application status must be
confirmed before enabling those features. This repository does not automatically
migrate an existing database at service startup.

## Verify before production use

Run `pnpm run typecheck`, `pnpm --filter @workspace/api-server run test`,
`pnpm --filter @workspace/api-server run build`,
`node --test scripts/serve-secure-static.test.mjs`, and both app builds listed
below. In Render, confirm the web service serves the authenticated app and
proxies `/api/healthz` to the API, then test Clerk sign-in, dealer/staff access,
CSRF-protected mutations, organization isolation, and authorized private file
downloads with test accounts. Do not use the sample preview to validate these
flows.

```sh
pnpm --filter @workspace/kessick-visualizer exec vite build --config vite.production.config.ts
pnpm --filter @workspace/kessick-visualizer exec vite build --config vite.render.config.ts
```

The website's current production Clerk settings, database, storage buckets and
credentials, DNS/custom-domain configuration, and the Concierge migration are
outside this repository and must be supplied or verified by their owners. The
official Kessick site could not be reached from this environment; verify
official product imagery, current product details, and dealer-policy URLs with
Kessick before publishing them. This branch does not apply migrations or change
production services or data.
