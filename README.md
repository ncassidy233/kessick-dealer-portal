# Kessick Dealer Portal

Private development handoff of the current Kessick workspace. Includes the staff
and builder portal, API server, database schemas/migrations, tests, concept video,
and design sandbox.

## Start here

- `replit.md`: project architecture and development context.
- `docs/kessick-staff-guide.md`: no-code staff workflows.
- `docs/kessick-concierge-knowledge.md`: concierge knowledge workflow.
- `docs/concierge-knowledge-api.md`: knowledge API and migration requirements.
- `.agents/memory/`: security and implementation constraints.

## Development

Use Node.js and pnpm (see `pnpm-workspace.yaml` and package manifests).
Run `pnpm install`, then `pnpm run typecheck`.
The portal package is `@workspace/kessick-visualizer`; its backend is
`@workspace/api-server`. Each package has its own dev/build scripts.

### Validation

- `pnpm --filter @workspace/kessick-visualizer test` runs frontend unit tests.
- `pnpm --filter @workspace/kessick-visualizer test:e2e` runs desktop and phone
  browser regressions. Install Playwright's Chromium first with
  `pnpm --filter @workspace/kessick-visualizer exec playwright install chromium`.
  The canvas tests use the development-only `/__e2e/canvas` route with local
  browser storage; real dealer and staff routes still require authentication.
- `pnpm --filter @workspace/api-server test` runs backend tests. For full database
  coverage, point `DATABASE_URL` at a **disposable local PostgreSQL database**
  initialized with `pnpm --filter @workspace/db push`, and set
  `KNOWLEDGE_DB_INTEGRATION_TEST=1`. Never use production credentials or data.
- `pnpm --filter @workspace/scripts test` and
  `node --test scripts/serve-secure-static.test.mjs` run catalog and static-server
  regressions.
- `PORT=5173 BASE_PATH=/ pnpm run build` typechecks and builds the workspace.

This application currently relies on Replit routing, PostgreSQL, managed Clerk
authentication, private object storage, and AI-provider configuration. A clone
alone does not recreate those services. Inspect each artifact's
`.replit-artifact/artifact.toml` and Vite configuration for ports and routing.
Configure required environment variables securely in the destination environment;
never commit credentials. See the source and project documentation for service
configuration before running outside Replit.

## Handoff status

The staff-publishes-form → builder-submits → staff-reviews/exports workflow has
passed browser verification. Staff pricing controls, draft previews, training
empty states, server-side form validation, and protected resource publication
were improved; focused tests and builds passed.

Outstanding: production concierge knowledge migration, live concierge
answer/citation verification, real-device push verification, and builder-request
assignment/resolution tracking. Do not assume these are complete.

## What this repository does not contain

Secrets, live database records, private uploaded documents, service accounts, and
the conversation history are not transferred. The GitHub handoff begins with a
snapshot of current source rather than Replit's checkpoint history. Original
reference ZIP archives and internal asset metadata are excluded.