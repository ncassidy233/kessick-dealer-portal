import type { ReactNode, ComponentProps } from "react";
import type { SignIn } from "@clerk/react";
import { Link } from "wouter";
import { LockKeyhole, ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import roomImage from "@assets/kessick-room-demo.jpg";

export const portalAuthAppearance: ComponentProps<typeof SignIn>["appearance"] = {
  variables: {
    colorPrimary: "#c9af76", colorPrimaryForeground: "#17150f",
    colorForeground: "#f3f0e8", colorMutedForeground: "#b9b7af",
    colorBackground: "#1b1b18", colorInput: "#242420",
    colorInputForeground: "#f3f0e8", colorDanger: "#ff9a91",
  },
  elements: {
    rootBox: "!w-full !max-w-none",
    cardBox: "!w-full !max-w-none !bg-transparent !shadow-none",
    card: "!bg-transparent !px-6 !py-7 sm:!px-8 !shadow-none",
    header: "!hidden", logoBox: "!hidden",
    formFieldInput: "!min-h-11 !text-base !border-white/25 focus:!ring-2 focus:!ring-[#c9af76]",
    formFieldLabel: "!text-[#e3e0d8]",
    formButtonPrimary: "!min-h-11 !bg-[#c9af76] !text-[#17150f] !font-semibold hover:!bg-[#ddc58e]",
    socialButtonsBlockButton: "!min-h-11 !border-white/25 !bg-[#242420] hover:!bg-[#31312b]",
    socialButtonsBlockButtonText: "!text-[#f3f0e8]",
    footer: "!bg-transparent !shadow-none", footerActionText: "!text-[#b9b7af]",
    footerActionLink: "!text-[#e2c991] underline underline-offset-4",
    identityPreviewText: "!text-[#f3f0e8]", formFieldErrorText: "!text-[#ffaaa2]",
    alertText: "!text-[#f3f0e8]",
  },
};

export function AuthLayout({ title, description, children }: {
  title: string; description: string; children: ReactNode;
}) {
  return (
    <div className="kessick-brand grid min-h-[100dvh] bg-[#121210] font-sans text-[#f3f0e8] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10 lg:px-12">
          <Link href="/" aria-label="Kessick home" className="inline-flex min-h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9af76]">
            <BrandLogo tone="light" className="h-8 w-auto max-w-[180px]" />
          </Link>
          <a href="https://kessickwinecellars.com/become-a-dealer/" className="inline-flex min-h-11 items-center gap-2 border border-[#b39862]/60 px-4 text-xs text-[#e2c991] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9af76]">
            Become a Dealer <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </header>
        <main id="main-content" className="mx-auto flex w-full max-w-[512px] flex-1 flex-col justify-center px-6 pb-10 pt-6 sm:px-8 lg:pb-16">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[#d2b77d]">Kessick partner portal</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-[42px]">{title}</h1>
          <p className="mb-7 mt-3 max-w-sm text-sm leading-6 text-[#b9b7af]">{description}</p>
          <div className="w-full border border-white/15 bg-[#1b1b18]">{children}</div>
          <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-[#c4c1b8]">
            <LockKeyhole className="mt-1 h-4 w-4 shrink-0 text-[#d2b77d]" aria-hidden="true" />
            <p>Use the email address associated with your Kessick account.</p>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#aaa89f]">First time here? Open your Kessick invitation to set up your account.</p>
        </main>
        <footer className="px-6 pb-6 text-xs text-[#aaa89f] sm:px-10 lg:px-12">© {new Date().getFullYear()} Kessick Wine Cellars</footer>
      </div>
      <aside aria-label="Kessick wine cellars" className="relative hidden min-h-full overflow-hidden border-l border-white/10 lg:block">
        <img src={roomImage} alt="Custom Kessick wine cellar" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121210] via-black/35 to-black/15" />
        <div className="absolute bottom-14 left-10 right-10 xl:left-14 xl:right-14">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-[#e2c991]">Craftsmanship. Collaboration. Kessick.</p>
          <p className="max-w-md font-serif text-4xl leading-tight xl:text-5xl">Extraordinary spaces.<br />Exceptional partnerships.</p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[#e0ddd4]">The resources, collections and support for your next Kessick project.</p>
        </div>
      </aside>
    </div>
  );
}
