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
import { CanvasStateProvider } from '@/store';
import { HomeInner } from '@/pages/home';
import { ProjectsModal } from '@/components/projects-modal';
import { AuthGuard, AccountDataGuard } from '@/components/auth/auth-guard';
import { StaffGuard } from '@/components/auth/staff-guard';
import { WorkspaceLayout } from '@/components/layouts/workspace-layout';
import { ClerkProvider, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { resolveOAuthAuthorizationDestination } from "@/lib/oauth-navigation";
import { StaffDealerViewContext } from "@/lib/staff-dealer-view-context";

import DemoPresentationPage from '@/pages/demo/index';
import { PortalLayout } from '@/components/layouts/portal-layout';
import PortalDashboard from '@/pages/portal/dashboard';
import DealerPortalPreview from '@/pages/portal/preview';
import PortalPricing from '@/pages/portal/pricing';
import PortalForms from '@/pages/portal/forms';
import PortalResources from '@/pages/portal/resources';
import PortalNotifications from '@/pages/portal/notifications';
import PortalAccount from '@/pages/portal/account';
import PageStudio from '@/pages/admin/page-studio';
import { PublishedPortalPage } from '@/components/studio-page';
import AdminUsers from '@/pages/admin/users';
import AdminGroups from '@/pages/admin/groups';
import AdminAccess from '@/pages/admin/access';
import AdminPricing from '@/pages/admin/pricing';
import AdminContent from '@/pages/admin/content';
import AdminNotifications from '@/pages/admin/notifications';
import AdminAudit from '@/pages/admin/audit';
import AdminOverview from '@/pages/admin/overview';
import DealerView from '@/pages/admin/dealer-view';
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
        <Route path="/" component={PublicLanding} />
        <Route path="/app" component={PublicLanding} />
        <Route path="/demo">
          <DemoPresentationPage />
        </Route>
        <Route path="/admin/preview">
          <AdminPreviewPage />
        </Route>
        <Route path="/portal/preview">
          <DealerPortalPreview />
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
              <PublishedPortalPage pageKey="home"><PortalDashboard /></PublishedPortalPage>
            </PortalLayout>
          </AuthGuard>
        </Route>

        <Route path="/portal/projects">
          <AuthGuard><PortalLayout><PublishedPortalPage pageKey="projects"><PortalProjects /></PublishedPortalPage></PortalLayout></AuthGuard>
        </Route>
        <Route path="/portal/collections">
          <AuthGuard><PortalLayout><PublishedPortalPage pageKey="collections"><PortalCollections /></PublishedPortalPage></PortalLayout></AuthGuard>
        </Route>
        <Route path="/portal/training">
          <AuthGuard><PortalLayout><PublishedPortalPage pageKey="training"><PortalTraining /></PublishedPortalPage></PortalLayout></AuthGuard>
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
              <PublishedPortalPage pageKey="resources"><PortalResources /></PublishedPortalPage>
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
        <Route path="/admin/dealer-view">
          <AuthGuard><StaffGuard><DealerView /></StaffGuard></AuthGuard>
        </Route>
        <Route path="/admin/dealer-view/:dealerId/*">
          {params => <AuthGuard><StaffGuard><DealerView dealerId={params.dealerId} /></StaffGuard></AuthGuard>}
        </Route>
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

        <Route path="/admin/page-studio">
          <AuthGuard><StaffGuard><PortalLayout><PageStudio /></PortalLayout></StaffGuard></AuthGuard>
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

function LocalCanvas() {
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [testClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }));
  return (
    <QueryClientProvider client={testClient}>
      <CanvasStateProvider userName="Local canvas">
        <HomeInner onExitProject={() => setProjectsOpen(true)} />
        <ProjectsModal open={projectsOpen} onOpenChange={setProjectsOpen} />
      </CanvasStateProvider>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  if (import.meta.env.DEV && import.meta.env.VITE_E2E_DEALER_VIEW === "1") {
    if (location === "/portal/preview") return <DealerPortalPreview />;
    if (location === "/__e2e/dealer-preview-context") {
      return <StaffDealerViewContext.Provider value={{ selectedDealerAccountId: new URLSearchParams(window.location.search).get("selectedDealerAccountId") ?? "", readOnly: true }}>
        <DealerPortalPreview />
      </StaffDealerViewContext.Provider>;
    }
  }
  if (import.meta.env.DEV && import.meta.env.VITE_E2E_DEALER_VIEW === "1" && (location === "/admin" || location.startsWith("/admin/") || location === "/portal" || location.startsWith("/portal/"))) {
    return <LocalDealerView location={location} />;
  }
  if (import.meta.env.DEV && location === "/__e2e/canvas") {
    return <LocalCanvas />;
  }
  if (!clerkPubKey) return <AuthConfigurationError />;
  return (
    <ClerkProviderWithRouter>
      <Router />
    </ClerkProviderWithRouter>
  );
}

function LocalDealerView({ location }: { location: string }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const dealerId = /^\/admin\/dealer-view\/([^/]+)\//.exec(location)?.[1];
  const dealerPages = { "/portal": PortalDashboard, "/portal/projects": PortalProjects, "/portal/collections": PortalCollections, "/portal/training": PortalTraining, "/portal/pricing": PortalPricing, "/portal/resources": PortalResources, "/portal/forms": PortalForms, "/portal/notifications": PortalNotifications, "/portal/account": PortalAccount };
  const adminPages = { "/admin": AdminOverview, "/admin/page-studio": PageStudio, "/admin/content": AdminContent, "/admin/users": AdminUsers, "/admin/groups": AdminGroups, "/admin/pricing": AdminPricing, "/admin/notifications": AdminNotifications, "/admin/access": AdminAccess, "/admin/audit": AdminAudit };
  const DealerPage = dealerPages[location as keyof typeof dealerPages];
  const AdminPage = adminPages[location as keyof typeof adminPages] ?? NotFound;
  return <QueryClientProvider client={client}>{DealerPage
    ? <AccountDataGuard><PortalLayout signOutControl={null}><DealerPage /></PortalLayout></AccountDataGuard>
    : <StaffGuard>{location.startsWith("/admin/dealer-view") ? <DealerView dealerId={dealerId} /> : <PortalLayout signOutControl={null}><AdminPage /></PortalLayout>}</StaffGuard>}
  </QueryClientProvider>;
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
