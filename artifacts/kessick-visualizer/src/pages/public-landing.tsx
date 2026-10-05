import { Link } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/react";
import { Redirect } from "wouter";
import demoRoomImg from '@assets/kessick-room-demo.jpg';

export default function PublicLanding() {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && isSignedIn) {
    return <Redirect to="/portal" />;
  }

  return (
    <div className="kessick-brand flex flex-col min-h-[100dvh] bg-[#121210] text-[#F3F0E8] font-sans selection:bg-[#B39862]/30 selection:text-[#B39862]">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 flex h-24 items-center justify-between px-6 md:px-12 bg-gradient-to-b from-[#121210]/80 to-transparent">
        <BrandLogo tone="light" className="h-6 md:h-8 w-auto" showWineCellarsName />
        <div className="flex items-center gap-6">
          <Link href="/demo" className="text-sm font-medium uppercase tracking-widest text-[#F3F0E8] hover:text-[#B39862] transition-colors">
            Preview
          </Link>
          <Link href="/sign-in" className="text-sm font-medium uppercase tracking-widest text-[#F3F0E8] hover:text-[#B39862] transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 relative flex items-center justify-center pt-24 pb-12 overflow-hidden min-h-[100dvh]">
        {/* Background Imagery */}
        <div className="absolute inset-0 z-0">
          <img 
            src={demoRoomImg} 
            alt="Kessick Wine Cellar" 
            className="w-full h-full object-cover object-center opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121210] via-[#121210]/60 to-[#121210]/30" />
        </div>

        <div className="relative z-10 w-full max-w-5xl px-6 md:px-12 flex flex-col items-center text-center">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#B39862] font-semibold mb-6">
            Authorized Dealership Network
          </h2>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-[#F3F0E8] leading-[1.1] mb-8">
            The Private Portal <br/>
            <span className="italic font-light text-[#B39862]">for Kessick Partners</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-[#F3F0E8]/70 max-w-2xl leading-relaxed mb-12 font-light">
            Access wholesale pricebooks, download architectural resources, submit forms,
            and review new product collections in one secure environment.
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 w-full max-w-4xl justify-center">
            <Button asChild size="lg" variant="outline" className="rounded-none h-14 px-10 text-xs uppercase tracking-widest font-semibold border-[#B39862]/50 text-[#F3F0E8] hover:bg-[#B39862]/10 hover:border-[#B39862] transition-colors w-full sm:w-auto">
              <Link href="/demo">View Preview</Link>
            </Button>
            <Button asChild size="lg" className="rounded-none h-14 px-10 text-xs uppercase tracking-widest font-semibold bg-[#B39862] text-white hover:bg-[#B39862]/90 transition-colors w-full sm:w-auto shadow-2xl">
              <Link href="/sign-in">Partner Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-none h-14 px-10 text-xs uppercase tracking-widest font-semibold border-[#B39862]/50 text-[#F3F0E8] hover:bg-[#B39862]/10 hover:border-[#B39862] transition-colors w-full sm:w-auto">
              <Link href="/sign-up">Request Access</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 bg-[#121210] border-t border-white/5 relative z-10">
        <p className="text-xs uppercase tracking-widest text-[#F3F0E8]/40">© {new Date().getFullYear()} Kessick Wine Cellars.</p>
        <div className="flex items-center gap-6 text-xs uppercase tracking-widest text-[#F3F0E8]/40">
          <span className="hover:text-[#B39862] cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-[#B39862] cursor-pointer transition-colors">Terms</span>
        </div>
      </footer>
    </div>
  );
}
