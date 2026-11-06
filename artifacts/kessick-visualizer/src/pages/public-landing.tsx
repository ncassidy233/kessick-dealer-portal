import { Link } from "wouter";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/react";
import { Redirect } from "wouter";
import demoRoomImg from '@assets/kessick-room-demo.jpg';
import { usePublicBranding, defaultPortalPublicBranding, type PortalPublicBranding } from "@/lib/public-branding";

export default function PublicLanding() {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && isSignedIn) {
    return <Redirect to="/continue" />;
  }

  return <PublicWelcome />;
}

export function PublicWelcome({ branding: brandingOverride }: { branding?: PortalPublicBranding }) {
  const branding = usePublicBranding(brandingOverride);
  return (
    <div className="kessick-brand flex flex-col min-h-[100dvh] bg-[#121210] text-[#F3F0E8] font-sans selection:bg-[#B39862]/30 selection:text-[#B39862]">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 flex h-24 items-center justify-between px-6 md:px-12 bg-gradient-to-b from-[#121210]/80 to-transparent">
        {branding.logoUrl ? <img src={branding.logoUrl} alt="Kessick" className="h-8 w-auto max-w-[180px] object-contain md:h-10" referrerPolicy="no-referrer" /> : <BrandLogo tone="light" className="h-6 md:h-8 w-auto" showWineCellarsName />}
        <div className="flex items-center gap-6">
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
            src={branding.imageUrl || demoRoomImg}
            alt={branding.imageAlt}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121210] via-[#121210]/60 to-[#121210]/30" />
        </div>

        <div className="relative z-10 w-full max-w-5xl px-6 md:px-12 flex flex-col items-center text-center">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#B39862] font-semibold mb-6">
            Authorized Dealership Network
          </h2>
          <h1 className="max-w-full break-words text-5xl md:text-7xl lg:text-8xl font-serif text-[#F3F0E8] leading-[1.1] mb-8">
            {branding.welcomeTitle === defaultPortalPublicBranding.welcomeTitle ? <>
              The Private Portal <br/>
              <span className="italic font-light text-[#B39862]">for Kessick Partners</span>.
            </> : branding.welcomeTitle}
          </h1>
          
          <p className="break-words text-lg md:text-xl text-[#F3F0E8]/70 max-w-2xl leading-relaxed mb-12 font-light">
            {branding.welcomeDescription}
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 w-full max-w-4xl justify-center">
            <Button asChild size="lg" className="rounded-none h-14 px-10 text-xs uppercase tracking-widest font-semibold bg-[#c9af76] text-[#17150f] hover:bg-[#ddc58e] transition-colors w-full sm:w-auto shadow-2xl">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-none h-14 px-10 text-xs uppercase tracking-widest font-semibold border-[#B39862]/50 text-[#F3F0E8] hover:bg-[#B39862]/10 hover:border-[#B39862] transition-colors w-full sm:w-auto">
              <a href="https://kessickwinecellars.com/become-a-dealer/">Become a Dealer</a>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 bg-[#121210] border-t border-white/5 relative z-10">
        <p className="text-xs uppercase tracking-widest text-[#F3F0E8]/40">© {new Date().getFullYear()} Kessick Wine Cellars.</p>
        <div className="flex items-center gap-6 text-xs uppercase tracking-widest text-[#F3F0E8]/40">
          <a href="https://kessickwinecellars.com/" className="inline-flex min-h-11 items-center text-white/70 hover:text-[#B39862] transition-colors">Kessick website</a>
        </div>
      </footer>
    </div>
  );
}
