import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { useGetAccount } from "@workspace/api-client-react";
import { Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConciergePanel } from "@/components/concierge/concierge-panel";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: accountContext } = useGetAccount();
  const role = accountContext?.account.role;
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/workspace" className="flex items-center shrink-0 hover:opacity-80 transition-opacity">
            <BrandLogo tone="light" className="h-6 w-auto" showWineCellarsName />
          </Link>
          
          <nav className="hidden md:flex items-center gap-1 pl-6 border-l border-border h-6">
            <Link 
              href="/workspace" 
              className={`px-3 py-1.5 text-sm font-medium rounded-none transition-colors ${location === '/workspace' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            >
              Projects
            </Link>
            <Link 
              href="/account" 
              className="px-3 py-1.5 text-sm font-medium rounded-none text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Account
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            data-testid="button-open-workspace-concierge"
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => setIsConciergeOpen(true)}
          >
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Ask Kessick</span>
          </Button>
          <Link href="/account" className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-sm font-medium leading-none">{accountContext?.account.displayName || accountContext?.account.email}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
              {role}
            </span>
          </div>
          <div className="w-8 h-8 rounded-none border border-border flex items-center justify-center bg-muted">
             <User className="w-4 h-4 text-foreground" />
          </div>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-y-auto no-scrollbar">
        {children}
      </main>
      <ConciergePanel open={isConciergeOpen} onOpenChange={setIsConciergeOpen} />
    </div>
  );
}