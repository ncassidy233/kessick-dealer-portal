import { SignIn } from "@clerk/react";
import { basePath } from "@/App";
import { authRouteWithRedirect, getValidatedAuthRedirect } from "@/lib/auth-redirect";
import { AuthLayout, portalAuthAppearance } from "./auth-layout";

export default function SignInPage() {
  const redirectUrl = getValidatedAuthRedirect();
  return (
    <AuthLayout title="Welcome back." description="Sign in to your Kessick account to continue.">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={authRouteWithRedirect("/sign-up", redirectUrl)} withSignUp={false} forceRedirectUrl={redirectUrl} appearance={portalAuthAppearance} />
    </AuthLayout>
  );
}
