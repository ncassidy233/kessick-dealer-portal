import { SignIn } from "@clerk/react";
import { basePath } from "@/App";
import { authRouteWithRedirect, getValidatedAuthRedirect } from "@/lib/auth-redirect";
import demoRoomImg from '@assets/kessick-room-demo.jpg';
import { BrandLogo } from "@/components/brand-logo";
import { Link } from "wouter";

export default function SignInPage() {
  const redirectUrl = getValidatedAuthRedirect();
  return (
    <div className="kessick-brand flex min-h-[100dvh] w-full bg-[#121210] text-[#F3F0E8] font-sans">
      <div className="min-w-0 flex-1 flex flex-col items-center justify-center px-4 pb-8 pt-28 sm:p-6 relative z-10">
        <Link href="/" className="absolute top-8 left-8 md:top-12 md:left-12 opacity-80 hover:opacity-100 transition-opacity">
          <BrandLogo tone="light" className="h-6 w-auto" />
        </Link>
        <div className="w-full max-w-md">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-3xl font-serif text-[#F3F0E8]">Welcome Back</h1>
            <p className="text-[#F3F0E8]/60 text-sm font-light">Sign in to the Kessick Dealer Portal</p>
          </div>
          <div className="[&_.cl-rootBox]:w-full [&_.cl-card]:bg-white/5 [&_.cl-card]:border [&_.cl-card]:border-white/10 [&_.cl-card]:rounded-none [&_.cl-card]:shadow-2xl [&_.cl-headerTitle]:hidden [&_.cl-headerSubtitle]:hidden [&_.cl-socialButtonsBlockButton]:rounded-none [&_.cl-socialButtonsBlockButton]:border-white/20 [&_.cl-socialButtonsBlockButtonText]:text-[#F3F0E8] [&_.cl-socialButtonsBlockButton]:hover:bg-white/10 [&_.cl-dividerLine]:bg-white/20 [&_.cl-dividerText]:text-[#F3F0E8]/50 [&_.cl-formFieldLabel]:text-[#F3F0E8]/80 [&_.cl-formFieldInput]:bg-white/5 [&_.cl-formFieldInput]:border-white/20 [&_.cl-formFieldInput]:text-[#F3F0E8] [&_.cl-formFieldInput]:rounded-none [&_.cl-formButtonPrimary]:bg-[#B39862] [&_.cl-formButtonPrimary]:text-white [&_.cl-formButtonPrimary]:rounded-none [&_.cl-formButtonPrimary]:hover:bg-[#B39862]/90 [&_.cl-footerActionText]:text-[#F3F0E8]/60 [&_.cl-footerActionLink]:text-[#B39862] [&_.cl-footerActionLink]:hover:text-[#B39862]/80 [&_.cl-identityPreviewText]:text-[#F3F0E8] [&_.cl-identityPreviewEditButtonIcon]:text-[#B39862]">
            <SignIn 
              routing="path" 
              path={`${basePath}/sign-in`}
              signUpUrl={authRouteWithRedirect('/sign-up', redirectUrl)}
              forceRedirectUrl={redirectUrl}
            />
          </div>
        </div>
      </div>
      <div className="hidden lg:block flex-1 relative border-l border-white/10">
        <img 
          src={demoRoomImg} 
          alt="Kessick Wine Cellar" 
          className="w-full h-full object-cover object-center opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121210] via-transparent to-transparent" />
        <div className="absolute bottom-12 left-12 max-w-md">
          <p className="font-serif text-3xl text-[#F3F0E8] leading-tight mb-4">"The standard for professional wine storage."</p>
          <p className="text-[#B39862] text-sm uppercase tracking-widest font-semibold">Estate Collection</p>
        </div>
      </div>
    </div>
  );
}
