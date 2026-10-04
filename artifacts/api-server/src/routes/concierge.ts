import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  auditEventsTable,
  conciergeConnectionsTable,
  db,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAccount, requireActiveAccount } from "../middlewares/auth";
import { requireConciergeScopes } from "../middlewares/conciergeAuth";
import {
  askConcierge,
  catalogGrounding,
  confirmAction,
  createConversation,
  getConversation,
  listConversationMessages,
  listConversations,
  listAuthorizedProjects,
  projectGrounding,
} from "../lib/conciergeService";
import {
  decodeConciergeCursor,
  decodeMessageCursor,
} from "../lib/conciergePagination";
import { authorizedProjectDto, validUuid } from "../lib/projectPolicy";
import { allowedConciergeScopes } from "../lib/conciergeScopes";

const router: IRouter = Router();
const allowedScopes = new Set<string>(allowedConciergeScopes);
const connectionBody = z.object({
  label: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(5),
  expiresInDays: z.number().int().min(1).max(90).default(30),
}).strict();
const askBody = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  acknowledgeCreditUsage: z.literal(true),
}).strict();
const createConversationBody = z.object({
  projectId: z.string().uuid().optional(),
}).strict();
const sendMessageBody = z.object({
  content: z.string().trim().min(1).max(4000),
  acknowledgeCreditUsage: z.literal(true),
}).strict();

function rejectMissingProjectScope(error: unknown, res: Response) {
  if (error instanceof Error && error.message === "PROJECT_SCOPE_REQUIRED") {
    res.status(403).json({ error: "project:read scope is required for project concierge data." });
    return true;
  }
  return false;
}

router.get(
  "/v1/concierge/usage",
  requireConciergeScopes("concierge:ask"),
  (_req, res) => {
    res.json({
      provider: "OpenAI via Replit AI Integrations",
      billing: "Requests consume the workspace owner's Replit AI credits.",
      userApiKeyRequired: false,
      model: "gpt-5.6-luna",
      maximumInputCharacters: 4000,
      maximumCompletionTokens: 8192,
      timeoutSeconds: 25,
      acknowledgementRequired: true,
    });
  },
);

router.get(
  "/v1/concierge/catalog/search",
  requireConciergeScopes("catalog:read"),
  async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query || query.length > 200) {
      res.status(400).json({ error: "Search query must be 1 to 200 characters." });
      return;
    }
    try {
      res.json(await catalogGrounding(query));
    } catch {
      res.status(503).json({ error: "Approved catalog is unavailable." });
    }
  },
);

router.get(
  "/v1/concierge/projects",
  requireConciergeScopes("project:read"),
  async (req, res) => {
    const projects = await listAuthorizedProjects(req);
    res.json(
      projects.map((project) =>
        authorizedProjectDto(project, req.account!.role === "customer"),
      ),
    );
  },
);

router.get(
  "/v1/concierge/projects/:projectId",
  requireConciergeScopes("project:read"),
  async (req, res) => {
    const projectId = String(req.params.projectId);
    const grounding = validUuid(projectId)
      ? await projectGrounding(req, projectId)
      : null;
    if (!grounding) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(grounding.value);
  },
);

router.get(
  "/v1/concierge/conversations",
  requireConciergeScopes("concierge:ask"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
  }),
  async (req, res) => {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    if (projectId && !validUuid(projectId)) {
      res.status(400).json({ error: "Invalid project context." });
      return;
    }
    try {
      const limit = Number(req.query.limit);
      const rawBefore =
        typeof req.query.before === "string" ? req.query.before : undefined;
      const before = decodeConciergeCursor(rawBefore);
      if (rawBefore && !before) {
        res.status(400).json({ error: "Invalid conversation cursor." });
        return;
      }
      res.json(
        await listConversations(req, projectId, {
          limit: Number.isFinite(limit) ? limit : undefined,
          before: before ?? undefined,
        }),
      );
    } catch (error) {
      if (rejectMissingProjectScope(error, res)) return;
      res.status(404).json({ error: "Project not found." });
    }
  },
);

router.post(
  "/v1/concierge/conversations",
  requireConciergeScopes("concierge:ask"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
  }),
  async (req, res) => {
    const parsed = createConversationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid conversation context." });
      return;
    }
    try {
      res.status(201).json(await createConversation(req, parsed.data.projectId));
    } catch (error) {
      if (rejectMissingProjectScope(error, res)) return;
      if (error instanceof Error && error.message === "CONVERSATION_QUOTA") {
        res.status(429).json({ error: "Conversation retention quota reached." });
        return;
      }
      res.status(404).json({ error: "Project not found." });
    }
  },
);

router.get(
  "/v1/concierge/conversations/:conversationId/messages",
  requireConciergeScopes("concierge:ask"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
  }),
  async (req, res) => {
    const conversationId = String(req.params.conversationId);
    if (!validUuid(conversationId)) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    try {
      const limit = Number(req.query.limit);
      const rawBefore =
        typeof req.query.before === "string" ? req.query.before : undefined;
      const before = decodeMessageCursor(rawBefore);
      if (rawBefore && !before) {
        res.status(400).json({ error: "Invalid message cursor." });
        return;
      }
      res.json(
        await listConversationMessages(req, conversationId, {
          limit: Number.isFinite(limit) ? limit : undefined,
          before: before ?? undefined,
        }),
      );
    } catch (error) {
      if (rejectMissingProjectScope(error, res)) return;
      res.status(404).json({ error: "Conversation not found." });
    }
  },
);

router.post(
  "/v1/concierge/conversations/:conversationId/messages",
  requireConciergeScopes("concierge:ask"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
    message: { error: "Concierge request limit reached. Try again later." },
  }),
  async (req, res) => {
    const conversationId = String(req.params.conversationId);
    const parsed = sendMessageBody.safeParse(req.body);
    if (!validUuid(conversationId) || !parsed.success) {
      res.status(400).json({
        error:
          "Invalid request. Credit usage acknowledgement and content are required.",
      });
      return;
    }
    try {
      const selected = await getConversation(req, conversationId);
      const answer = await askConcierge(req, {
        message: parsed.data.content,
        conversationId,
        ...(selected?.projectId ? { projectId: selected.projectId } : {}),
      });
      const messages = await listConversationMessages(req, conversationId);
      res.json(
        messages.items.find((message) => message.id === answer.messageId) ??
          messages.items[messages.items.length - 1],
      );
    } catch (error) {
      if (rejectMissingProjectScope(error, res)) return;
      const code = error instanceof Error ? error.message : "";
      if (code.includes("NOT_FOUND")) {
        res.status(404).json({ error: "Conversation not found." });
      } else if (code === "MESSAGE_QUOTA") {
        res.status(429).json({ error: "Conversation message retention quota reached." });
      } else {
        res.status(503).json({
          error:
            "Kessick AI could not complete the request. No project action was taken.",
        });
      }
    }
  },
);

router.post(
  "/v1/concierge/ask",
  requireConciergeScopes("concierge:ask"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
    message: { error: "Concierge request limit reached. Try again later." },
  }),
  async (req, res) => {
    const parsed = askBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          "Invalid request. Credit usage acknowledgement and a message are required.",
      });
      return;
    }
    req.log.info(
      {
        actorAccountId: req.account!.id,
        inputCharacters: parsed.data.message.length,
        hasProject: Boolean(parsed.data.projectId),
      },
      "Concierge request accepted",
    );
    try {
      res.json(await askConcierge(req, parsed.data));
    } catch (error) {
      if (rejectMissingProjectScope(error, res)) return;
      const code = error instanceof Error ? error.message : "";
      if (
        code === "PROJECT_NOT_FOUND" ||
        code === "CONVERSATION_NOT_FOUND"
      ) {
        res.status(404).json({ error: "Authorized concierge context not found." });
      } else if (code === "CONVERSATION_PROJECT_MISMATCH") {
        res.status(409).json({ error: "Conversation project context cannot change." });
      } else if (
        code === "CONVERSATION_QUOTA" ||
        code === "MESSAGE_QUOTA"
      ) {
        res.status(429).json({ error: "Concierge retention quota reached." });
      } else {
        res.status(503).json({
          error:
            "Kessick AI could not complete the request. No project action was taken.",
        });
      }
    }
  },
);

router.post(
  "/v1/concierge/actions/:actionId/confirm",
  requireConciergeScopes("action:confirm", "project:read"),
  async (req, res) => {
    if (req.body?.confirm !== true || !validUuid(String(req.params.actionId))) {
      res.status(400).json({ error: "Explicit confirmation is required." });
      return;
    }
    try {
      const conversationId =
        typeof req.body?.conversationId === "string"
          ? req.body.conversationId
          : undefined;
      if (conversationId && !validUuid(conversationId)) {
        res.status(400).json({ error: "Invalid conversation confirmation." });
        return;
      }
      res.json(
        await confirmAction(req, String(req.params.actionId), conversationId),
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "ACTION_STALE") {
        res.status(409).json({
          error: "The project changed. Review a new action before confirming.",
        });
      } else {
        res.status(404).json({ error: "Pending authorized action not found." });
      }
    }
  },
);

router.get(
  "/v1/concierge/connections",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const rows = await db
      .select()
      .from(conciergeConnectionsTable)
      .where(eq(conciergeConnectionsTable.accountId, req.account!.id))
      .orderBy(desc(conciergeConnectionsTable.createdAt));
    res.json(
      rows.map((row) => ({
        id: row.id,
        label: row.label,
        tokenPrefix: row.tokenPrefix,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
      })),
    );
  },
);

router.post(
  "/v1/concierge/connections",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const parsed = connectionBody.safeParse(req.body);
    if (
      !parsed.success ||
      parsed.data.scopes.some((scope) => !allowedScopes.has(scope))
    ) {
      res.status(400).json({ error: "Invalid connection or scope request." });
      return;
    }
    const active = await db
      .select({ id: conciergeConnectionsTable.id })
      .from(conciergeConnectionsTable)
      .where(
        and(
          eq(conciergeConnectionsTable.accountId, req.account!.id),
          isNull(conciergeConnectionsTable.revokedAt),
        ),
      );
    if (active.length >= 5) {
      res.status(409).json({ error: "Revoke an existing connection first." });
      return;
    }
    const token = `ksk_${randomBytes(32).toString("base64url")}`;
    const [connection] = await db
      .insert(conciergeConnectionsTable)
      .values({
        accountId: req.account!.id,
        label: parsed.data.label,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        tokenPrefix: token.slice(0, 12),
        scopes: parsed.data.scopes,
        expiresAt: new Date(
          Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000,
        ),
      })
      .returning();
    await db.insert(auditEventsTable).values({
      actorAccountId: req.account!.id,
      action: "concierge.connection.created",
      targetType: "concierge_connection",
      targetId: connection.id,
      metadata: { scopes: parsed.data.scopes, expiresAt: connection.expiresAt.toISOString() },
    });
    res.status(201).json({
      id: connection.id,
      token,
      tokenPrefix: connection.tokenPrefix,
      scopes: connection.scopes,
      expiresAt: connection.expiresAt,
      warning: "Copy this token now. It is not shown again.",
    });
  },
);

router.delete(
  "/v1/concierge/connections/:connectionId",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const connectionId = String(req.params.connectionId);
    if (!validUuid(connectionId)) {
      res.status(404).json({ error: "Connection not found." });
      return;
    }
    const [revoked] = await db
      .update(conciergeConnectionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(conciergeConnectionsTable.id, connectionId),
          eq(conciergeConnectionsTable.accountId, req.account!.id),
          isNull(conciergeConnectionsTable.revokedAt),
        ),
      )
      .returning();
    if (!revoked) {
      res.status(404).json({ error: "Connection not found." });
      return;
    }
    await db.insert(auditEventsTable).values({
      actorAccountId: req.account!.id,
      action: "concierge.connection.revoked",
      targetType: "concierge_connection",
      targetId: revoked.id,
      metadata: {},
    });
    res.status(204).end();
  },
);

export default router;