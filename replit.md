# Kessick Dealer Portal

Private dealer portal for Kessick pricing, resources, information requests, notifications, and administrator-managed dealer access.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

The active product is a private, mobile-responsive dealer portal for verified Kessick trade users, not a public consumer storefront. Preserve the existing AR experience and its work unchanged as an explicitly On Hold legacy feature, unavailable from normal dealer navigation.

Focus on dealer access, pricing, resources, forms and responses, notifications, and staff administration. Administrators manage dealer access and content; dealers consume assigned content and submit requested information.

Approved visual direction: Modern Trade Desk for the operational shell, navigation, tables, projects and staff dashboard; Heritage Luxe for login, app icon, hero imagery and premium brand moments; Atelier Resource Hub for catalog, training, finishes and resources. Palette: near-black #121210, brass #B39862, ivory #F3F0E8, walnut #6B4B35; editorial serif headlines with clean sans-serif operational text. Clearly label sample prices and project/customer data as demo data.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
