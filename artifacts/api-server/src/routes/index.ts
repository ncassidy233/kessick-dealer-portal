import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import accountsRouter from "./accounts";
import conciergeRouter from "./concierge";
import conciergeKnowledgeRouter from "./conciergeKnowledge";
import mcpRouter from "./mcp";
import oauthRouter from "./oauth";
import portalRouter from "./portal";
import portalV2Router, { startPortalV2Scheduler } from "./portalV2";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(conciergeRouter);
router.use(conciergeKnowledgeRouter);
router.use(mcpRouter);
router.use(oauthRouter);
router.use(accountsRouter);
router.use(portalRouter);
router.use(portalV2Router);
startPortalV2Scheduler();

export default router;
