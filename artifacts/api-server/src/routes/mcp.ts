import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { auditEventsTable, db } from "@workspace/db";
import { requireConciergeScopes } from "../middlewares/conciergeAuth";
import {
  askConcierge,
  catalogGrounding,
  listAuthorizedProjects,
  projectGrounding,
} from "../lib/conciergeService";
import { authorizedProjectDto, validUuid } from "../lib/projectPolicy";
import { hasConciergeScope } from "../lib/conciergeScopes";

const router: IRouter = Router();
const rpcBody = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const mcpToolCallParamsSchema = z.object({
  name: z.string().min(1).max(100),
  arguments: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const mcpSearchCatalogArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
}).strict();
export const mcpListProjectsArgsSchema = z.object({}).strict();
export const mcpGetProjectArgsSchema = z.object({
  projectId: z.string().uuid(),
}).strict();
export const mcpAskConciergeArgsSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional(),
  acknowledgeCreditUsage: z.literal(true),
}).strict();

const tools = [
  {
    name: "search_catalog",
    description: "Search the approved Kessick public catalog. Pricing is excluded.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", maxLength: 200 } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_projects",
    description: "List projects the authenticated user is authorized to read.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_project",
    description: "Read one authorized project. Customer pricing is redacted.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", format: "uuid" } },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_concierge",
    description:
      "Ask grounded Kessick AI. Consumes Replit AI credits and never executes actions.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", maxLength: 4000 },
        projectId: { type: "string", format: "uuid" },
        acknowledgeCreditUsage: { const: true },
      },
      required: ["message", "acknowledgeCreditUsage"],
      additionalProperties: false,
    },
  },
];

router.post(
  "/v1/mcp",
  requireConciergeScopes("mcp:use"),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.account!.id,
    message: {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32029, message: "MCP request limit reached" },
    },
  }),
  async (req, res) => {
    const parsed = rpcBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" },
      });
      return;
    }
    const { id, method, params = {} } = parsed.data;
    const notification = id === undefined;
    if (notification && method === "notifications/initialized") {
      res.status(202).end();
      return;
    }
    const fail = (code: number, message: string) => {
      if (notification) {
        res.status(202).end();
      } else {
        res.json({ jsonrpc: "2.0", id, error: { code, message } });
      }
    };
    try {
      if (method === "initialize") {
        if (notification) {
          res.status(202).end();
        } else {
          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "kessick-concierge", version: "1.0.0" },
            },
          });
        }
        return;
      }
      if (method === "tools/list") {
        const visibleTools = tools.filter((tool) =>
          tool.name === "search_catalog"
            ? req.conciergeScopes?.includes("catalog:read")
            : tool.name === "list_projects" || tool.name === "get_project"
              ? req.conciergeScopes?.includes("project:read")
              : req.conciergeScopes?.includes("concierge:ask"),
        );
        if (notification) {
          res.status(202).end();
        } else {
          res.json({ jsonrpc: "2.0", id, result: { tools: visibleTools } });
        }
        return;
      }
      if (method !== "tools/call") {
        fail(-32601, "Method not found");
        return;
      }
      const toolRequest = mcpToolCallParamsSchema.safeParse(params);
      if (!toolRequest.success) {
        fail(-32602, "Invalid tool or arguments");
        return;
      }
      const { name } = toolRequest.data;
      const args = toolRequest.data.arguments ?? {};
      await db.insert(auditEventsTable).values({
        actorAccountId: req.account!.id,
        organizationId: null,
        projectId: null,
        action: "concierge.mcp.tool.invoked",
        targetType: "mcp_tool",
        targetId: req.conciergeConnectionId ?? null,
        metadata: {
          tool: typeof name === "string" ? name : "unknown",
          connectionId: req.conciergeConnectionId ?? null,
          projectId:
            typeof args.projectId === "string" && validUuid(args.projectId)
              ? args.projectId
              : null,
        },
      });
      let result: unknown;
      if (name === "search_catalog") {
        const input = mcpSearchCatalogArgsSchema.safeParse(args);
        if (!input.success) {
          fail(-32602, "Invalid tool or arguments");
          return;
        }
        if (!req.conciergeScopes?.includes("catalog:read")) {
          fail(-32003, "catalog:read scope required");
          return;
        }
        result = await catalogGrounding(input.data.query);
      } else if (name === "list_projects") {
        if (!mcpListProjectsArgsSchema.safeParse(args).success) {
          fail(-32602, "Invalid tool or arguments");
          return;
        }
        if (!req.conciergeScopes?.includes("project:read")) {
          fail(-32003, "project:read scope required");
          return;
        }
        result = (await listAuthorizedProjects(req)).map((project) =>
          authorizedProjectDto(project, req.account!.role === "customer"),
        );
      } else if (name === "get_project") {
        const input = mcpGetProjectArgsSchema.safeParse(args);
        if (!input.success) {
          fail(-32602, "Invalid tool or arguments");
          return;
        }
        if (!req.conciergeScopes?.includes("project:read")) {
          fail(-32003, "project:read scope required");
          return;
        }
        result = (await projectGrounding(req, input.data.projectId))?.value;
        if (!result) {
          fail(-32004, "Project not found");
          return;
        }
      } else if (
        name === "ask_concierge"
      ) {
        const input = mcpAskConciergeArgsSchema.safeParse(args);
        if (!input.success) {
          fail(-32602, "Invalid tool or arguments");
          return;
        }
        if (!req.conciergeScopes?.includes("concierge:ask")) {
          fail(-32003, "concierge:ask scope required");
          return;
        }
        if (
          input.data.projectId &&
          !hasConciergeScope(req.conciergeScopes, "project:read")
        ) {
          fail(-32003, "project:read scope required for project questions");
          return;
        }
        result = await askConcierge(req, {
          message: input.data.message,
          ...(input.data.projectId
            ? { projectId: input.data.projectId }
            : {}),
        });
      } else {
        fail(-32602, "Invalid tool or arguments");
        return;
      }
      if (notification) {
        res.status(202).end();
      } else {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result) }],
            isError: false,
          },
        });
      }
    } catch {
      fail(-32000, "Tool request could not be completed");
    }
  },
);

export default router;