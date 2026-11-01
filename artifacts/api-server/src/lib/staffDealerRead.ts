import type { Request } from "express";
import type { Account } from "@workspace/db";
import { getAuthorizedStaffRole } from "../middlewares/auth";

const selectedDealers = new WeakMap<Request, Account>();
const staffDealerAccess = new WeakMap<Request, Promise<boolean>>();

export function setStaffDealerRead(req: Request, dealer: Account): void {
  selectedDealers.set(req, dealer);
}

export function dealerReadAccount(req: Request): Account | undefined {
  return req.method === "GET" ? selectedDealers.get(req) ?? req.account : req.account;
}

/** Staff browse the complete published portal as themselves. A selected dealer
 * view still uses that dealer's own audience and permissions, and stays read-only. */
export function staffHasFullDealerAccess(req: Request): Promise<boolean> {
  if (selectedDealers.has(req)) return Promise.resolve(false);
  let access = staffDealerAccess.get(req);
  if (!access) {
    access = getAuthorizedStaffRole(req).then(Boolean);
    staffDealerAccess.set(req, access);
  }
  return access;
}
