# Kessick Render environment files — October 19, 2026

These files follow the real portal/API configuration documented in open PR #2, not the sample-only static preview.

## Which file goes where

| File | Destination |
| --- | --- |
| deploy/render/kessick-api.env.example | Render **API Node service** environment |
| deploy/render/kessick-frontend.env.example | Render **authenticated portal Node service** environment |

Do not import the API file into the frontend service. The current public static preview has no authenticated API and needs neither file. Importing environment variables alone does not deploy or connect the full application.

## Replace placeholders first

Every active value starting with REPLACE_ must be replaced before deployment. Placeholder text is not a working credential. Existing values were not retrieved from Render or other providers.

- Clerk: obtain the real publishable and secret key from the same Clerk application. The frontend's VITE_CLERK_PUBLISHABLE_KEY and API's CLERK_PUBLISHABLE_KEY must match.
- DATABASE_URL: use the intended PostgreSQL connection string, including the correct provider TLS configuration. Do not invent a hostname or strip required query parameters.
- API_ORIGIN: use the actual deployed API HTTPS origin, with no /api path. The proposed service name in a blueprint does not prove that URL exists.
- PRIVATE_OBJECT_DIR and PUBLIC_OBJECT_SEARCH_PATHS: use the existing slash-prefixed GCS paths the source expects, not made-up public URLs.
- GOOGLE_CLOUD_PROJECT: actual GCP project ID.
- GOOGLE_APPLICATION_CREDENTIALS: this template uses /etc/secrets/kessick-gcp.json. Add a Render Secret File named kessick-gcp.json containing the authorized service-account JSON. The path is a target configuration; the file has not been created/uploaded for you.
- KESSICK_ALLOWED_ORIGINS: prefilled with the client-shared https://kessick-dealer-black.onrender.com. Confirm that this is the actual authenticated portal origin before deployment. If it differs, replace this value with the intended exact HTTPS origin.

SESSION_SECRET is deliberately a placeholder. Set its real value directly in Render. If the intended API already has SESSION_SECRET, retain it; for a new service, generate a high-entropy secret in the trusted deployment environment. Do not copy the value into Claude's workspace, prompt or output.

Optional Web Push and AI variables are commented out. Leave them unset until their actual provider/subscriptions are configured. Comments are not imported as variables.

## Import into Render

1. Choose the correct service in the intended Render workspace.
2. Open Environment, then Add from .env.
3. Import/paste the matching service file after filling its placeholders. Review collisions and preserve unrelated existing settings.
4. Save only if the source/deployment is not ready. Once the matching code and credentials are ready, rebuild/deploy the frontend when VITE_ build values change; deploy the API when its runtime values change.
5. Confirm /api/healthz and real Clerk sign-in/staff/dealer access. A green preview does not test the authenticated app.

Leave PORT unset in these files; Render provides the web-service port. Do not change NODE_ENV or BASE_PATH to try to cure a missing-credentials error. Verify that build tooling still installs the dependencies needed to build.

If Blueprint-managed settings also define a variable, reconcile the service and Blueprint source of truth before syncing. This task creates files only; no Render setting, deployment, secret file, credential or database was changed.

## Claude use

Read these as configuration inputs; they do not sign Claude in to Render/GitHub. Keep secret-bearing environment files out of Git and public frontend assets. VITE_ variables are browser-visible build inputs and must never contain server secrets.

The existing API does not automatically load this downloaded .env merely because the file exists. In Render, use Environment import; locally use the current application's supported environment-loading mechanism.

## Verified platform references

- https://render.com/docs/configure-environment-variables — Add from .env, save/deploy behavior, secret files and /etc/secrets/<filename>.
- https://render.com/docs/environment-variables — platform-provided defaults including web-service PORT.

The application's environment names and service split come from the repository configuration and docs in the prior handoff. Current service settings and credential values remain unverified.


## Keep secrets out of Claude

Give Claude these unfilled templates only. Enter actual keys and connection strings directly in Render Dashboard > service > Environment. Never attach a filled production .env or GCP credential JSON to Claude. Keep those files outside its workspace. A .gitignore rule prevents accidental Git tracking; it does not prevent an agent with filesystem/terminal access from reading a file.

Claude can prepare code using placeholders and push changes to GitHub. The intended Render service can deploy that code using variables already stored in Render. Check the service's deployment configuration first. Do not give Claude a Render API key or broad secret-management access if your goal is to keep all secret values outside its reach.

## Open deployment decision: client-shared URL

`render.yaml` on this branch names the authenticated frontend service `kessick-dealer-portal`. A new Blueprint service with that name gets a new `*.onrender.com` URL; it does not take over `https://kessick-dealer-black.onrender.com`, the URL already shared with the client. Before syncing the Blueprint, decide how the authenticated portal will be served at that URL (for example, by pointing the existing `kessick-dealer-black` service at this build, or by attaching a custom domain), and set `KESSICK_ALLOWED_ORIGINS` to whichever origin actually serves the portal.

## Variables the code reads that are not in these templates

- `APPROVED_CATALOG_PATH` (API, optional): falls back to `artifacts/kessick-visualizer/public/data/kessick-products.json` in the repo.
- `LOG_LEVEL` (API, optional): defaults to `info`.
