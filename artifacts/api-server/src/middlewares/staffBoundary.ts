import { Router, type RequestHandler } from "express";
import { getAuthorizedStaffRole, requireAccount, requireActiveAccount } from "./auth";

// A second, deny-by-default boundary protects current AND future staff routes.
// Individual handlers still enforce their narrower role/capability requirements.
export function createStaffBoundary(authenticate: RequestHandler = requireAccount) {
  const router = Router();
  router.use(["/staff", "/portal-v2/admin"], authenticate, requireActiveAccount, async (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!await getAuthorizedStaffRole(req)) {
      req.log?.warn({ event: "security.staff_access_denied", accountId: req.account?.id, method: req.method, namespace: req.baseUrl }, "Staff access denied");
      res.status(403).json({ error: "Authorized staff access required." });
      return;
    }
    next();
  });
  return router;
}
export default createStaffBoundary();
