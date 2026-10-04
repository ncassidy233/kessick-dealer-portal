export function dealerProvisioningPlan(
  requestedStatus: "pending" | "approved" | "suspended" | undefined,
  organizationId?: string,
) {
  const status = requestedStatus ?? "approved";
  return {
    status,
    createOrganization: !organizationId,
    membershipRole: organizationId ? "member" as const : "owner" as const,
    membershipStatus: status,
  };
}