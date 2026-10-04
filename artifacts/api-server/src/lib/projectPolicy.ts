import type { Request } from "express";
import {
  db,
  dealerOrganizationsTable,
  organizationMembershipsTable,
  projectInvitationsTable,
  projectsTable,
  type JsonValue,
  type Project,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { getAuthorizedStaffRoleForAccount } from "../middlewares/auth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const durableSnapshotKeys = new Set([
  "project",
  "entities",
  "options",
  "activeOptionId",
  "calibration",
  "pixelsPerInch",
  "unit",
  "roomImageId",
  "canvasCoordinateVersion",
  "lastSaved",
  "instances",
  "constructionDocument",
  "estimates",
  "activeEstimateId",
  "pipeline",
  "catalogSnapshot",
]);

export function validUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function durableProjectSnapshot(snapshot: JsonValue): JsonValue {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => durableSnapshotKeys.has(key)),
  ) as Record<string, JsonValue>;
}

export function redactCustomerSnapshot(snapshot: JsonValue): JsonValue {
  if (Array.isArray(snapshot)) return snapshot.map(redactCustomerSnapshot);
  if (snapshot === null || typeof snapshot !== "object") return snapshot;
  const redacted: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (
      key === "estimates" ||
      key === "priceSnapshot" ||
      key === "authorized_price"
    ) {
      continue;
    }
    if (key === "activeEstimateId") {
      redacted[key] = null;
      continue;
    }
    if (
      key === "catalogSnapshot" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      redacted[key] = {
        ...(redactCustomerSnapshot(value) as Record<string, JsonValue>),
        prices: {},
      };
      continue;
    }
    redacted[key] = redactCustomerSnapshot(value);
  }
  return redacted;
}

export function authorizedProjectDto(project: Project, customerSafe = false) {
  const snapshot = durableProjectSnapshot(project.snapshot);
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    snapshot: customerSafe ? redactCustomerSnapshot(snapshot) : snapshot,
    version: project.version,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function currentMembership(accountId: string) {
  const [row] = await db
    .select({
      membership: organizationMembershipsTable,
      organization: dealerOrganizationsTable,
    })
    .from(organizationMembershipsTable)
    .innerJoin(
      dealerOrganizationsTable,
      eq(
        organizationMembershipsTable.organizationId,
        dealerOrganizationsTable.id,
      ),
    )
    .where(eq(organizationMembershipsTable.accountId, accountId))
    .limit(1);
  return row ?? null;
}

export async function canReadProject(
  req: Pick<Request, "account">,
  project: Project,
): Promise<boolean> {
  const account = req.account!;
  if (account.status !== "approved") return false;
  if (
    account.role === "staff" &&
    staffRoleCanReadProjects(await getAuthorizedStaffRoleForAccount(account))
  ) return true;
  if (account.role === "dealer") {
    const membership = await currentMembership(account.id);
    return (
      membership?.membership.status === "approved" &&
      membership.organization.status === "approved" &&
      membership.organization.id === project.organizationId
    );
  }
  const [grant] = await db
    .select({ id: projectInvitationsTable.id })
    .from(projectInvitationsTable)
    .where(
      and(
        eq(projectInvitationsTable.projectId, project.id),
        eq(projectInvitationsTable.acceptedByAccountId, account.id),
        eq(projectInvitationsTable.status, "accepted"),
      ),
    )
    .limit(1);
  return Boolean(grant);
}

export async function canWriteProject(
  req: Pick<Request, "account">,
  project: Project,
): Promise<boolean> {
  const account = req.account!;
  if (account.status !== "approved") return false;
  if (
    account.role === "staff" &&
    staffRoleCanWriteProjects(await getAuthorizedStaffRoleForAccount(account))
  ) return true;
  if (account.role !== "dealer" || account.status !== "approved") return false;
  const membership = await currentMembership(account.id);
  return (
    membership?.membership.status === "approved" &&
    membership.organization.status === "approved" &&
    membership.organization.id === project.organizationId
  );
}

type StaffRole =
  | "super_admin"
  | "staff_admin"
  | "sales_rep"
  | "content_manager"
  | null;

export function staffRoleCanReadProjects(role: StaffRole): boolean {
  return role === "super_admin" || role === "staff_admin" || role === "sales_rep";
}

export function staffRoleCanWriteProjects(role: StaffRole): boolean {
  return role === "super_admin" || role === "staff_admin" || role === "sales_rep";
}

export async function findProject(id: string): Promise<Project | null> {
  if (!validUuid(id)) return null;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.archivedAt)))
    .limit(1);
  return project ?? null;
}