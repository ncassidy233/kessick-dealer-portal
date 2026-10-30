import type { Request } from "express";
import type { Account } from "@workspace/db";

const selectedDealers = new WeakMap<Request, Account>();

export function setStaffDealerRead(req: Request, dealer: Account): void {
  selectedDealers.set(req, dealer);
}

export function dealerReadAccount(req: Request): Account | undefined {
  return req.method === "GET" ? selectedDealers.get(req) ?? req.account : req.account;
}
