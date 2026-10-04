# Kessick AI external connections

Kessick AI uses OpenAI through Replit AI Integrations. End users do not provide an
OpenAI key. AI calls consume the workspace owner's Replit AI credits; clients
must read `GET /api/v1/concierge/usage` and send
`acknowledgeCreditUsage: true` before an AI request.

Concierge keeps at most 100 conversations per account and 200 persisted
messages per conversation. Conversation and message reads are paginated with
`limit` and an ISO `before` cursor (maximums are 50 and 100 respectively).
Creation and reads are account-rate-limited; AI requests are additionally
limited to 20 per 15 minutes. Responses are bounded and provider calls time
out after 25 seconds.

## Custom GPT Action (recommended: OAuth 2 + PKCE)

Register a client while signed in with `POST /api/oauth/clients`, providing the
GPT redirect URI and only required scopes. In the Custom GPT Action
authentication settings select OAuth 2 authorization-code with PKCE, use the
returned `clientId` and one-time `clientSecret`, and configure:

- Authorization URL: `https://YOUR-KESSICK-ORIGIN/api/oauth/authorize`
- Token URL: `https://YOUR-KESSICK-ORIGIN/api/oauth/token`
- Scopes: `catalog:read`, `project:read`, and `concierge:ask` for read-only use

When the GPT connects, Kessick requires the user to authenticate in the
browser (redirecting to Kessick sign-in when needed) and explicitly consent to
the requested scopes. The token and revocation endpoints accept HTTP Basic
client authentication or `client_id` and `client_secret` form fields.
Authorization codes
expire after five minutes and are one-time PKCE-bound values. Access tokens
expire after 15 minutes; refresh tokens are rotated and expire after 30 days.
Revoke a client with `DELETE /api/oauth/clients/{clientId}` or revoke an
individual token with `POST /api/oauth/revoke`.

The OpenAPI document includes this OAuth security scheme and the complete
versioned concierge operations. Do not put a Kessick access or refresh token
in a prompt or server log.

Tokens belong to one signed-in account, expire within 90 days, are stored only
as SHA-256 hashes, and never broaden that account's project permissions.

## MCP

Configure a streamable HTTP/JSON-RPC connection to
`https://YOUR-KESSICK-ORIGIN/api/v1/mcp` with an OAuth access token and
`mcp:use` plus only tool scopes needed. The adapter supports `initialize`,
`notifications/initialized` (HTTP 202 with no body), `tools/list`, and
`tools/call`. Its approved tools are `search_catalog`, `list_projects`,
`get_project`, and `ask_concierge`; `tools/list` hides tools outside the token's
scopes. Every tool call is audited with the account, connection, tool, and
authorized project context. This is JSON response Streamable HTTP (not an SSE
session) and has no server push or resumable event stream.
`ask_concierge` additionally requires `concierge:ask` and explicit credit
acknowledgement. MCP has no database, filesystem, pricing, ordering, payment,
messaging, or approval tools.

## Revocation

OAuth clients and tokens are revoked immediately and audited. Also disconnect
the client in ChatGPT/MCP. A legacy `ksk_...` scoped connection token can still
be created from the signed-in Kessick connection-management endpoints for
MCP/admin fallback; it is not the recommended Custom GPT authentication path.
List fallback connections with `GET /api/v1/concierge/connections`, revoke one
with `DELETE /api/v1/concierge/connections/{connectionId}`, and create a new
token rather than attempting to recover an old one.