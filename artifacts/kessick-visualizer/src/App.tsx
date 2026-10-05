import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import PublicLanding from '@/pages/public-landing';
import SignInPage from '@/pages/auth/sign-in';
import SignUpPage from '@/pages/auth/sign-up';
import PendingApprovalPage from '@/pages/pending-approval';
import ForbiddenPage from '@/pages/forbidden';
import ProjectsPage from '@/pages/workspace/projects';
import ProjectEditorPage from '@/pages/workspace/project-editor';
import InvitationPage from '@/pages/invitation';
import AccountPage from '@/pages/account';
import { AppProvider } from '@/store';
import { HomeInner } from '@/pages/home';
import { AuthGuard } from '@/components/auth/auth-guard';
import { StaffGuard } from '@/components/auth/staff-guard';
import { WorkspaceLayout } from '@/components/layouts/workspace-layout';
import { ClerkProvider, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { resolveOAuthAuthorizationDestination } from "@/lib/oauth-navigation";

import DemoPresentationPage from '@/pages/demo/index';
import { PortalLayout } from '@/components/layouts/portal-layout';
import PortalDashboard from '@/pages/portal/dashboard';
import PortalPricing from '@/pages/portal/pricing';
import PortalForms from '@/pages/portal/forms';
import PortalResources from '@/pages/portal/resources';
import PortalNotifications from '@/pages/portal/notifications';
import PortalAccount from '@/pages/portal/account';
import AdminUsers from '@/pages/admin/users';
import AdminGroups from '@/pages/admin/groups';
import AdminAccess from '@/pages/admin/access';
import AdminPricing from '@/pages/admin/pricing';
import AdminContent from '@/pages/admin/content';
import AdminNotifications from '@/pages/admin/notifications';
import AdminAudit from '@/pages/admin/audit';
import AdminOverview from '@/pages/admin/overview';
import AdminPreviewPage from '@/pages/admin/preview';
import AdminKnowledge from '@/pages/admin/knowledge';
import AdminConciergeInsights from '@/pages/admin/concierge-insights';
import PortalProjects from '@/pages/portal/projects';
import PortalCollections from '@/pages/portal/collections';
import PortalTraining from '@/pages/portal/training';

import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function AuthConfigurationError() {
  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <section className="max-w-lg border border-border bg-card p-8" role="alert">
        <h1 className="text-xl font-semibold">Sign-in is unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This deployment is missing its Clerk publishable key. Access remains
          locked until an administrator completes authentication configuration.
        </p>
      </section>
    </main>
  );
}

function ClerkProviderWithRouter({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const navigateAfterAuth = (to: string, replace = false) => {
    const oauthDestination = resolveOAuthAuthorizationDestination(
      to,
      window.location.origin,
      basePath,
    );
    if (oauthDestination) {
      if (replace) {
        window.location.replace(oauthDestination);
      } else {
        window.location.assign(oauthDestination);
      }
      return;
    }
    navigate(stripBase(to), replace ? { replace: true } : undefined);
  };

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => navigateAfterAuth(to)}
      routerReplace={(to) => navigateAfterAuth(to, true)}
      appearance={{
        theme: dark,
        cssLayerName: 'clerk',
        options: {
          logoPlacement: 'inside',
          logoLinkUrl: basePath || '/',
          logoImageUrl: `${window.location.origin}${basePath}/kessick-logo-white.svg`,
          socialButtonsPlacement: 'top',
        },
        variables: {
          colorPrimary: 'hsl(41 29% 43%)',
          colorForeground: 'hsl(0 0% 98%)',
          colorMutedForeground: 'hsl(0 0% 70%)',
          colorBackground: 'hsl(0 0% 10%)',
          colorInput: 'hsl(0 0% 14%)',
          colorInputForeground: 'hsl(0 0% 98%)',
          colorDanger: 'hsl(0 80% 55%)',
          colorNeutral: 'hsl(0 0% 30%)',
          fontFamily: "'Avenir Next', Avenir, 'Segoe UI', sans-serif",
          borderRadius: '0',
        },
        elements: {
          rootBox: 'w-full min-w-0 flex justify-center',
          cardBox: 'bg-card !w-full !max-w-[440px] !min-w-0 overflow-hidden',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButtonText: 'text-foreground',
          formFieldLabel: 'text-foreground',
          footerActionLink: 'text-primary',
          footerActionText: 'text-muted-foreground',
          dividerText: 'text-muted-foreground',
          identityPreviewEditButton: 'text-primary',
          formFieldSuccessText: 'text-primary',
          alertText: 'text-foreground',
          logoBox: 'h-12',
          logoImage: 'max-h-10',
          socialButtonsBlockButton: 'border-border bg-input text-foreground rounded-none',
          formButtonPrimary: 'bg-primary text-primary-foreground rounded-none',
          formFieldInput: 'bg-input border-border text-foreground rounded-none',
          footerAction: 'bg-transparent',
          dividerLine: 'bg-border',
          alert: 'border-border bg-muted rounded-none',
          otpCodeFieldInput: 'bg-input border-border text-foreground rounded-none',
          formFieldRow: 'text-foreground',
          main: 'gap-5',
        }
      }}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to the Kessick Dealer Portal',
          },
        },
        signUp: {
          start: {
            title: 'Create your Kessick account',
            subtitle: 'Use a verified email to continue',
          },
        },
      }}
    >
      <AuthScopedQueryProvider>{children}</AuthScopedQueryProvider>
    </ClerkProvider>
  );
}

function AuthScopedQueryProvider({ children }: { children: ReactNode }) {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  const [scope, setScope] = useState(() => ({
    userId,
    client: new QueryClient(),
  }));

  useEffect(() => {
    if (isLoaded && scope.userId !== userId) {
      setScope({ userId, client: new QueryClient() });
    }
  }, [isLoaded, scope.userId, userId]);

  if (!isLoaded || scope.userId !== userId) return null;
  return (
    <QueryClientProvider client={scope.client}>
      {children}
    </QueryClientProvider>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {import.meta.env.DEV && (
          <Route path="/__e2e/canvas">
            <AppProvider persistLocal={false} persistImages={false}>
              <HomeInner />
            </AppProvider>
          </Route>
        )}
        <Route path="/" component={PublicLanding} />
        <Route path="/app" component={PublicLanding} />
        <Route path="/demo">
          <DemoPresentationPage />
        </Route>
        <Route path="/admin/preview">
          <AdminPreviewPage />
        </Route>
        <Route path="/sign-in/*?">
          <SignInPage />
        </Route>
        <Route path="/sign-up/*?">
          <SignUpPage />
        </Route>

        {/* Auth Required Routes */}
        <Route path="/invitation/:token">
          <AuthGuard>
            <InvitationPage />
          </AuthGuard>
        </Route>

        <Route path="/pending-approval">
          <AuthGuard>
            <PendingApprovalPage />
          </AuthGuard>
        </Route>

        <Route path="/forbidden">
          <AuthGuard>
            <ForbiddenPage />
          </AuthGuard>
        </Route>

        <Route path="/workspace">
          <AuthGuard>
            <StaffGuard>
            <WorkspaceLayout>
              <ProjectsPage />
            </WorkspaceLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/workspace/project/:projectId">
          <AuthGuard>
            <StaffGuard>
             <ProjectEditorPage />
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/portal">
          <AuthGuard>
            <PortalLayout>
              <PortalDashboard />
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/projects">
          <AuthGuard><PortalLayout><PortalProjects /></PortalLayout></AuthGuard>
        </Route>
        <Route path="/portal/collections">
          <AuthGuard><PortalLayout><PortalCollections /></PortalLayout></AuthGuard>
        </Route>
        <Route path="/portal/training">
          <AuthGuard><PortalLayout><PortalTraining /></PortalLayout></AuthGuard>
        </Route>
        <Route path="/portal/pricing">
          <AuthGuard>
            <PortalLayout>
              <PortalPricing />
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/forms">
          <AuthGuard>
            <PortalLayout>
              <PortalForms />
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/resources">
          <AuthGuard>
            <PortalLayout>
              <PortalResources />
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/notifications">
          <AuthGuard>
            <PortalLayout>
              <PortalNotifications />
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/account">
          <AuthGuard>
            <PortalLayout>
              <PortalAccount />
            </PortalLayout>
          </AuthGuard>
        </Route>

        {/* Admin Routes */}
        <Route path="/admin">
          <AuthGuard><StaffGuard><PortalLayout><AdminOverview /></PortalLayout></StaffGuard></AuthGuard>
        </Route>
        <Route path="/admin/users">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminUsers />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/groups">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminGroups />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/access">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminAccess />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/pricing">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminPricing />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/content">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminContent />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/notifications">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminNotifications />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/audit">
          <AuthGuard>
            <StaffGuard>
              <PortalLayout>
                <AdminAudit />
              </PortalLayout>
            </StaffGuard>
          </AuthGuard>
        </Route>

        <Route path="/admin/knowledge">
          <AuthGuard><StaffGuard><PortalLayout><AdminKnowledge /></PortalLayout></StaffGuard></AuthGuard>
        </Route>
        <Route path="/admin/concierge-insights">
          <AuthGuard><StaffGuard><PortalLayout><AdminConciergeInsights /></PortalLayout></StaffGuard></AuthGuard>
        </Route>

        <Route path="/account">
          <AuthGuard>
            <AccountPage />
          </AuthGuard>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  if (!clerkPubKey) return <AuthConfigurationError />;
  return (
    <ClerkProviderWithRouter>
      <Router />
    </ClerkProviderWithRouter>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
      <Toaster />
      <SonnerToaster richColors position="top-right" />
    </TooltipProvider>
  );
}

export default App;