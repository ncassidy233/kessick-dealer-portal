export function portalInvitationRedirectUrl(
  origin: string,
  basePath: string,
  role: "dealer" | "staff",
): string {
  const normalizedBasePath = `/${basePath.split("/").filter(Boolean).join("/")}/`;
  const appBase = new URL(normalizedBasePath, origin);
  const signUpUrl = new URL("sign-up", appBase);
  const destination = new URL(role === "dealer" ? "portal" : "admin", appBase);
  signUpUrl.searchParams.set("redirect_url", destination.pathname);
  return signUpUrl.toString();
}
