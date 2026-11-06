import { SignIn } from "@clerk/react";
import { basePath } from "@/App";
import { authRouteWithRedirect, getValidatedAuthRedirect } from "@/lib/auth-redirect";
import { AuthLayout, portalAuthAppearance } from "./auth-layout";
import goldKLogo from "@assets/kessick-gold-k-signin.jpeg";

export default function SignInPage() {
  const redirectUrl = getValidatedAuthRedirect();
  return (
    <AuthLayout signIn title="Welcome back." description="Sign in to your Kessick account to continue." logoSrc={goldKLogo}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={authRouteWithRedirect("/sign-up", redirectUrl)} withSignUp={false} forceRedirectUrl={redirectUrl} appearance={{ ...portalAuthAppearance, elements: { ...portalAuthAppearance?.elements, footerAction: "!hidden" } }} />
    </AuthLayout>
  );
}
