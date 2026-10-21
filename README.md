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

This application relies on PostgreSQL, managed Clerk authentication, private
Google Cloud Storage, and optional AI-provider configuration. A clone alone does
not recreate those services. Replit artifact configurations remain available for
that environment; the authenticated app and API can also be deployed separately
on Render. See [the Render deployment guide](docs/render-deployment.md) for
required services, environment variables, database preparation, and verification.
Never commit credentials.

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