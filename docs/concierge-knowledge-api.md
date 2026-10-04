# Concierge knowledge API

Base `/api/staff/concierge`. All endpoints require a current Clerk account and authorized staff role `super_admin`, `staff_admin`, or `content_manager`. Insights require `super_admin` or `staff_admin`. Errors are `{error: string}`. Cookies same-origin; JSON mutations use `Content-Type: application/json`; raw PUT MUST include `X-Kessick-CSRF: 1`.

Documents are separate from dealer portal resources. Retrieval, not model training. PDF and UTF-8 TXT only, maximum 10 MiB. PDF maximum 100 pages, extracted text maximum 200,000 characters; scanned/image-only PDFs require OCR outside this app. Unsafe/active PDFs are rejected.

## Upload
1. POST `/knowledge/uploads/request` JSON `{fileName, contentType, byteSize}`; returns `{uploadId, uploadUrl, expiresAt}`. `contentType`: `application/pdf` or `text/plain`. URL is same-origin; never substitute an object-storage URL.
2. PUT `uploadUrl` with raw File bytes, matching Content-Type and `X-Kessick-CSRF: 1`. Returns `{ok:true}`. Browser supplies Content-Length.
3. POST `/knowledge/uploads/{uploadId}/complete` JSON `{title, category?}` returns document (201). Default category `General`, audience `staff`, status `review`. Extraction failures return document status `error` with `errorMessage` so staff can inspect/delete/re-upload; no silent empty text.

## Manage
- GET `/knowledge` returns `{items: Document[]}` (newest first, bounded 200). List `extractedText` is intentionally `""`; text is omitted at SQL selection time to keep mobile responses small. Fetch detail to view/edit full text.
- GET `/knowledge/{id}` returns Document including extractedText.
- PATCH `/knowledge/{id}` JSON `{title?, category?, extractedText?, audience?, confirmDealerVisibility?}` returns Document. Audience `staff|approved_dealers`; selecting dealers MUST show explicit confirmation and send `confirmDealerVisibility:true`. Every edit sends document to `review`, never automatically active.
- POST `/knowledge/{id}/status` JSON `{status:"active"|"review"|"archived"}` returns Document. Explicit activation only after review; review deactivates immediately. Error/empty documents cannot activate.
- DELETE `/knowledge/{id}` JSON `{}` returns `{ok:true}`; logical deletion, immediately unavailable for retrieval.
- GET `/knowledge/export?format=json|txt` downloads metadata+text for nondeleted documents; never exports private object paths.

Document: `{id,title,category,fileName,contentType,byteSize,audience,status,extractedText,errorMessage,createdAt,updatedAt}`. `errorMessage` nullable; ISO timestamps. States `review|active|archived|error`. Do not render extracted text as HTML.

## Insights
- GET `/insights?from=YYYY-MM-DD&to=YYYY-MM-DD` returns `{from,to,totals:{conversations,answered,unanswered,failed},sourceUsage:[{sourceType,count}],knowledgeGaps:[{reason,count}]}`.
- GET `/insights/export?from=YYYY-MM-DD&to=YYYY-MM-DD` downloads formula-safe CSV using the same aggregates.
- Dates inclusive UTC calendar days; defaults last 30 days, maximum 366 days.
- Aggregate cross-tenant operational counts only. No raw questions, transcripts, project names, account names, quotes, or free-text gap clusters. Gaps are fixed reason buckets, not invented question topics.

Only active eligible documents participate in bounded exact-quote grounding: authorized staff can use staff/dealer documents; approved dealer members in approved organizations can use dealer documents; customers get neither. Historical knowledge quotes are revalidated against current eligibility. Archives/deletes exclude future retrieval.

## Migration / operations

Development: additive migration `lib/db/migrations/20260603_concierge_knowledge.sql` applied explicitly. Production: run the identical SQL transaction through the deployment migration process before releasing this backend. Do not run schema push-force; no existing data/tables are modified or deleted.

Production migration has NOT been applied by this implementation. There is no existing automatic production migration runner wired in this repository. If the knowledge table/columns are missing, management returns explicit HTTP 503 migration-required errors; the existing concierge continues using its other authorized sources and adds a visible knowledge-unavailable notice. Historical knowledge quotes fail closed. Unrelated database errors are not swallowed.

Upload intents persist in PostgreSQL across Autoscale instances. Bytes use create-only writes, generation-pinned promotion, and private storage. Replays are rejected; completed completion calls are idempotent while intent is valid. No original download endpoint is exposed, including for quarantined error files. Delete is logical: original bytes and audit history are retained; no retention job deletes existing user data.

Limits: 10 upload intents per actor per ten-minute window, global existing request/upload throttles, 15-second PDF worker timeout with 128 MiB old-generation heap, 100 pages, 200,000 extracted characters. Request-upload intents expire after ten minutes. Interrupted uploading/processing requires a new upload. Library list shows at most 200; export at most 500 (explicit error beyond cap).

Insights use real persisted assistant-message status/citation counts and conversation creation timestamps. In-progress `received` messages are not counted as answered/unanswered/failed. Unanswered is `unknown` plus `partial`; source usage counts citation occurrences, not distinct documents. Historical source-use counts are intentionally retained after archival. No tenant identifiers or content appear in aggregate exports.

Development retrieval integration test: `KNOWLEDGE_DB_INTEGRATION_TEST=1 NODE_ENV=development pnpm --filter @workspace/api-server exec tsx --test src/lib/knowledgeRetrieval.integration.test.ts`. It executes the real retrieval functions and persisted staff/dealer eligibility joins on transaction-local temporary copies of the table structures, then rolls back. It does not mutate user records, mock authorization decisions, call Clerk, or run in production mode. Without explicit opt-in it is skipped.