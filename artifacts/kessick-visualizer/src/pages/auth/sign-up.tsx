import { SignUp } from "@clerk/react";
import { basePath } from "@/App";
import { authRouteWithRedirect, getValidatedAuthRedirect } from "@/lib/auth-redirect";
import { AuthLayout, portalAuthAppearance } from "./auth-layout";

export default function SignUpPage() {
  const redirectUrl = getValidatedAuthRedirect();
  return (
    <AuthLayout title="Set up your account." description="Use the email address from your Kessick invitation.">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={authRouteWithRedirect("/sign-in", redirectUrl)} forceRedirectUrl={redirectUrl} appearance={portalAuthAppearance} />
    </AuthLayout>
  );
}
