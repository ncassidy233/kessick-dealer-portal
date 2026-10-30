import { Router, type RequestHandler } from "express";
import { accountsTable, auditEventsTable, db } from "@workspace/db";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getAuthorizedStaffRole, requireAccount, requireActiveAccount } from "../middlewares/auth";
import { approvedDealerAccountIds, isApprovedDealerAccount } from "../lib/portalDealerEligibility";
import { portalHandlers } from "./portal";
import { portalV2Handlers } from "./portalV2";
import { hasPortalCapability } from "../lib/portalPermissions";

const uuid = z.string().uuid();

export function isDealerPreviewRead(method: string, path: string): boolean {
  return method === "GET" && (
    /^\/dealer-portal\/(?:dashboard|pricing|forms|resources|access|push-config)$/.test(path) ||
    /^\/dealer-portal\/resources\/[0-9a-f-]{36}\/file$/.test(path) ||
    /^\/portal-v2\/(?:bootstrap|content|projects|notifications|notification-preferences)$/.test(path)
  );
}

export function createDealerPreviewRouter(authenticate: RequestHandler = requireAccount) {
  const router = Router();
  router.use(authenticate, requireActiveAccount, async (req, res, next) => {
    const role = await getAuthorizedStaffRole(req);
    if (!role || !hasPortalCapability(role, "dealer-view:read")) {
      res.status(403).json({ error: "Authorized staff access required." });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get("/", async (_req, res) => {
    const ids = await approvedDealerAccountIds();
    const dealers = ids.length ? await db.select({
      id: accountsTable.id,
      displayName: accountsTable.displayName,
      email: accountsTable.email,
    }).from(accountsTable).where(inArray(accountsTable.id, ids)).orderBy(asc(accountsTable.displayName), asc(accountsTable.email)) : [];
    res.json({ dealers });
  });
  router.use("/:accountId", async (req, res, next) => {
    if (!isDealerPreviewRead(req.method, req.path)) {
      res.status(403).json({ error: "Dealer View is read-only. This endpoint is unavailable." });
      return;
    }
    const id = uuid.safeParse(req.params.accountId);
    if (!id.success || !await isApprovedDealerAccount(id.data)) {
      res.status(403).json({ error: "An approved dealer organization membership is required." });
      return;
    }
    const [dealer] = await db.select().from(accountsTable).where(eq(accountsTable.id, id.data)).limit(1);
    if (!dealer) { res.status(403).json({ error: "Dealer unavailable." }); return; }
    const actor = req.account;
    if (req.path === "/portal-v2/bootstrap") {
      await db.insert(auditEventsTable).values({ actorAccountId: actor!.id, action: "portal.dealer_view.opened", targetType: "account", targetId: dealer.id, metadata: { readOnly: true } });
    }
    // The verified staff identity is retained; only these allowlisted reads use dealer targeting.
    req.log?.info({ actorAccountId: actor!.id, dealerAccountId: dealer.id, path: req.path }, "Staff Dealer View");
    req.account = dealer;
    const restore = () => { req.account = actor; };
    res.once("finish", restore);
    res.once("close", restore);
    next();
  }, portalHandlers, portalV2Handlers, (_req, res) => {
    res.status(404).json({ error: "Dealer page data not found." });
  });
  router.use((_req, res) => { res.status(403).json({ error: "Dealer View is read-only." }); });
  return router;
}

export default createDealerPreviewRouter();
