# Kessick Page Studio delivery — November 1, 2026

This change extends `copilot/kessick-dealer-portal-development` at `5a2574da4e9b3e1f48d9edec038f7831e4ecdd43`.
The tested changes are uploaded to `codex/finish-page-studio` in PR #14. The uploaded source tree was verified byte-for-byte against local commit `34c19907ebcc225e36e00c317d935719dee3ec49`. The additive publication-history migration was applied successfully on November 1, 2026. PR #14 was merged as `9605c0a2c4ad00e056413af1fbd86cb9a70fa174`; both Render services were deployed successfully. The GitHub connector remains read-only; uploads were completed through the user-authorized signed-in browser.

## Staff workspace repair — November 1

- Authorized, approved staff can open the complete dealer portal directly as themselves; a dealer organization is not required for staff. Published content and resources are available across dealer audiences. Suspended, unclaimed and revoked staff remain denied.
- Selected-dealer inspection keeps the chosen dealer's exact restrictions, isolated caches, read-only behavior and audit records.
- Staff View / Dealer View switches work on phone, tablet and desktop. The white staff workspace has an explicit Layout & Theme entry, an Editor mobile tab, a full tools menu, and prominent editor/dealer actions on the overview.
- The public entry page links to the actual authenticated Staff Portal. The separate sample preview is not the staff workspace.
- Page Studio opens with a mobile, tablet or desktop canvas appropriate to the screen, with the existing save/preview/publish workflow retained.
- Sign-up explains the verified Clerk behavior: the 30-second timer is a resend cooldown and codes are valid for ten minutes. Email verification and server-side identity checks remain enabled.
- Validation: 76 API tests and 29 frontend unit tests pass; TypeScript checks and both production builds pass. Browser verification covers staff navigation, the editor and dealer access at all three screen sizes, in addition to existing publish/restore and selected-dealer isolation checks. Browser accounts are test fixtures.

## Included

- Staff Page Studio at `/admin/page-studio`, reachable through the staff menu and task guide.
- Shared typed renderer for dealer home, projects, collections, training and resources; existing business tools remain beneath the authored sections. A published homepage hero replaces the original homepage hero.
- Hero, text and audience-filtered content grid sections; add, reorder by drag or accessible buttons, duplicate, hide, remove, undo and redo.
- Text, image URL/alt text, focal point, fit, alignment, buttons, background and spacing controls. Existing Kessick styling is the default.
- Server draft saves with optimistic revision checks, autosave after first save, and visible save/validation/conflict failures. Edits remain open after a failed save.
- Mobile 390×844, Tablet 820×1180, Desktop 1440×900 previews with actual iframe CSS viewports, visual scaling, rotate, full-screen workspace, and small-screen panel switching.
- Separate explicit Publish confirmation; `pages:publish` is granted to staff administrators. Content managers can edit but cannot publish or restore. Server APIs recheck the authorized staff identity and capability.
- Atomic, serialized publication and immutable version history. Restore creates a new published version, preserving the current draft and recording the actor and source version in audit events.
- Approved dealers fetch only published page documents. Staff Dealer View uses the same renderer through selected-account read-only endpoints, with response-field allowlisting and account-specific query caches.
- The supplied Kessick headquarters photo is packaged locally and used for the authenticated homepage hero and initial home template.
- Official Become a Dealer links in the login header and below the login form. Default login return is `/portal`; staff routing still resolves through the existing guards.
- The previously proposed production Vite config and same-origin API proxy have been brought forward from existing repository commit `d352a2f`, retaining static-file protection, cookies, CSRF headers and restrictive security headers.

## Verification

- API and frontend TypeScript checks: passed.
- Authenticated production frontend build: passed.
- API production build: passed.
- API suite: 76 passed, zero skipped, against isolated PostgreSQL-compatible PGlite with the repository schema applied. This includes real persisted draft/publish/restore and dealer-isolation integration tests. This is not validation against the hosted production database.
- Frontend unit suite: 29 passed.
- Static server/proxy suite: 3 passed.
- Browser suite: 6 Page Studio and 30 staff Dealer View tests across desktop, tablet and phone, passed. These use mocked browser API responses; database behavior is verified separately.
- Browser checks verify true preview widths, explicit publish confirmation, content-manager denial, save-conflict recovery, account isolation and read-only behavior.
- Existing API `https://kessick-portal-api.onrender.com/api/healthz`: HTTP 200, `{"status":"ok"}`. The same-origin frontend `/api/healthz` also returned `{"status":"ok"}`; protected data returned `Authentication required` when signed out.

Build output retains existing source-map, CSS-selector and bundle-size warnings. They did not prevent compilation.

## Deployment sequence

1. Upload the tested commit onto a new branch based on the development branch; preserve PR #13 and the existing preview build. Do not replace the root preview Blueprint with an unrelated app.
2. Before releasing the new API, run the additive SQL in `deploy/migrations/20261101-page-studio-history.sql` against the intended portal database. The existing draft/publication tables must already exist. Backfill preserves any existing published page.
3. Deploy the API from the tested commit. Its existing build/start commands remain valid. Confirm `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`, the staff bootstrap configuration, and `KESSICK_ALLOWED_ORIGINS` privately. Never commit actual values.
4. Build the authenticated frontend with:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @workspace/kessick-visualizer exec vite build --config vite.production.config.ts
   ```

   Set `VITE_CLERK_PUBLISHABLE_KEY` at build time. Start the Node frontend with:

   ```sh
   node scripts/serve-secure-static.mjs artifacts/kessick-visualizer/dist/public
   ```

   Set runtime `API_ORIGIN=https://kessick-portal-api.onrender.com` and Render-provided `PORT`. The frontend must be a Node web service; the current static demo services cannot run this proxy. Preserve the agreed client URL when its rollout is authorized. The `kessick-dealer-black` service now builds the authenticated app and runs the static/API proxy server. The obsolete `VITE_CLERK_PROXY_URL` is cleared for the current Clerk development instance. The API start command trims surrounding whitespace from its existing Clerk keys before importing the server; no secret values are stored in source.

5. Verify Clerk sign-in and real account bootstrap for approved dealer, pending dealer, content manager and staff admin. Verify staff role authorization is tied to the actual Clerk user. No automatic elevation of a new login is included.
6. Confirm Page Studio save across two browsers, edit conflict, preview privacy, publish, dealer refresh within 30 seconds, version restore, and staff read-only Dealer View on the hosted deployment.

GitHub uploads are complete. Cloudflare Workers and Pages and Cursor were removed from the Kessick repository at the user's request. Render remains the deployment target. No credentials were committed or copied into chat.

## Boundaries still requiring follow-through

This delivers the structured editor and controlled publishing phase. It does not implement every future Page Studio template or a full asset-management product: images are edited by safe URL plus the packaged headquarters image; no new upload/media-library workflow, arbitrary HTML, arbitrary custom colors, cropping UI, publishing schedules, or global header/footer editor is claimed. Existing resource uploads and content targeting are preserved.

The editor appends authored sections to the existing dealer tools; it does not allow staff to delete protected business functionality. Preview shows the authored sections, while dynamic content grids explain that dealer-specific published records are resolved per account on the dealer route.

The frontend-to-API connection and signed-out protection are verified on Render. Owner-authorized staff placeholders are provisioned in the database and bind to the matching verified Clerk identity at first sign-in. Real-user authenticated editing/persistence and GCS/private-upload credentials still require hosted verification; shared-browser Google login inspection was blocked by automatic approval review. Render's database query tool could not connect because the database's external IP allowlist is empty; that restriction was left intact.

## Rollback

Revert the code deployment to the baseline commit. Leave the additive history table in place to preserve publication snapshots. Page Studio content rollback is separate: an authorized staff administrator can restore a prior published version without a code deployment.
