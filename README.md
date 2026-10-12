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

## Existing Render dealer preview

Keep the existing service and public URL: <https://kessick-dealer-black.onrender.com/>.
Do not create a new service or apply a new Blueprint to replace it.

In that service's **Settings → Build & Deploy**, use:

- **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @workspace/kessick-visualizer exec vite build --config vite.render.config.ts`
- **Publish directory:** `artifacts/kessick-visualizer/dist/render-preview`
- **Root directory:** repository root (leave blank).
- **Branch:** the branch containing the approved preview changes. Changes pushed
  to a review branch do not update a service configured to deploy `main`; merge
  into the configured branch or explicitly select the review branch on this
  existing service.
- Use the pinned pnpm version from `package.json`; enable Corepack if the runner
  does not honor `packageManager`. Do not use pnpm 12 with this pnpm 10 workspace.
- Remove any additional CSS-writing, `sed`, or black-theme override commands
  after the build. The repository's old `.dealer-preview-surface` overrides have
  been removed.

Then use **Manual Deploy → Clear build cache & deploy** on the existing service.
Verify Render reports **Live**, the deployed commit matches the intended commit,
and the existing URL displays “Your Kessick project desk.” on a lavender-gray
background without requiring sign-in. Render dashboard access is needed to
confirm the configured deployment branch, build command and live deployment.

The isolated entry imports only public preview content, the bundled logo and
local inspiration photograph. It does not load Clerk, call private dealer APIs,
publish the product/pricing catalog, or include staff administration. Staff and
dealer authorization in the full application remain unchanged. Feedback opens
a prefilled email draft; the sender must review and send it. Teamwork uses its
public sign-in page, with a contact action for Kessick-specific invitations.
The voucher and Cask Collection card are explicitly unapproved examples.

The supplied cover/checklist screenshots and an approved building-header
photograph are not included in this handoff. The header currently uses the local
inspiration photograph and says so; exact screenshot matching and replacement
with the approved building photograph remain pending those assets.

Preview regression checks use the existing Playwright framework:

1. Build with the command above.
2. Run `pnpm --filter @workspace/kessick-visualizer exec vite preview --config vite.render.config.ts --host 127.0.0.1 --port 4173`.
3. In another terminal run `PLAYWRIGHT_DEALER_PREVIEW=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 pnpm --filter @workspace/kessick-visualizer run test:e2e dealer-preview.spec.ts --project=desktop`.

These checks exercise 320, 375, 768 and 1440px layouts, images, navigation,
search/filtering, all resource categories, email drafts and the public/private
boundary. The 375px screenshot is written to `/tmp/kessick-dealer-cover-375.png`.
They validate link destinations, not external website availability; live links
and email/telephone handlers must also be verified on an internet-connected
device.