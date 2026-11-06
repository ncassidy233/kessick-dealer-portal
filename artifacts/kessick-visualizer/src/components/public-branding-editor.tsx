import { publicPortalBranding } from "@workspace/api-zod";
import { type PortalPublicBranding } from "@/lib/public-branding";
import { AuthLayout } from "@/pages/auth/auth-layout";
import { PublicWelcome } from "@/pages/public-landing";
import goldKLogo from "@assets/kessick-gold-k-signin.jpeg";

const fields: { key: keyof PortalPublicBranding; label: string; limit: number; multiline?: boolean }[] = [
  { key: "signInTitle", label: "Sign-in heading", limit: 100 },
  { key: "signInDescription", label: "Sign-in introduction", limit: 300, multiline: true },
  { key: "welcomeTitle", label: "Welcome heading", limit: 160 },
  { key: "welcomeDescription", label: "Welcome introduction", limit: 600, multiline: true },
  { key: "sideHeading", label: "Photo panel heading", limit: 160, multiline: true },
  { key: "sideDescription", label: "Photo panel introduction", limit: 400, multiline: true },
  { key: "imageUrl", label: "Background image URL", limit: 2048 },
  { key: "imageAlt", label: "Background image description", limit: 250 },
  { key: "logoUrl", label: "Portal logo URL", limit: 2048 },
];

export function PublicBrandingFields({ branding, disabled, onChange }: {
  branding: PortalPublicBranding;
  disabled: boolean;
  onChange: (patch: Partial<PortalPublicBranding>) => void;
}) {
  const input = "min-h-11 w-full min-w-0 rounded-lg border border-[#171715]/20 bg-white px-3 py-2 text-sm text-[#171715]";
  return <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
    <legend className="mb-3 text-lg font-semibold">Login & Welcome</legend>
    <p className="text-sm leading-6 text-[#171715]/70">Update the public welcome page and sign-in design. Save and publish these settings together with Dealer home.</p>
    {fields.map(({ key, label, limit, multiline }) => <label key={key} className="block space-y-2 text-xs font-semibold">
      <span>{label}</span>
      {multiline
        ? <textarea className={input} rows={3} maxLength={limit} value={branding[key] ?? ""} onChange={event => onChange({ [key]: event.target.value })} />
        : <input className={input} type={key.endsWith("Url") ? "url" : "text"} maxLength={limit} value={branding[key] ?? ""} onChange={event => onChange({ [key]: event.target.value })} />}
    </label>)}
    <p className="text-xs leading-5 text-[#171715]/70">Use public HTTPS image links. Leave an image or logo URL empty to keep the current Kessick artwork. Sign-in methods and account access stay managed by Kessick.</p>
  </fieldset>;
}

export function FaviconEditor({ branding, disabled, preview, onChange }: {
  branding: PortalPublicBranding;
  disabled: boolean;
  preview: boolean;
  onChange: (faviconUrl: string) => void;
}) {
  const faviconUrl = branding.faviconUrl ?? "";
  const defaultIcon = `${import.meta.env.BASE_URL}assets/kessick-favicon-32.png`;
  const previewUrl = publicPortalBranding(branding)?.faviconUrl || defaultIcon;

  return <section aria-label="Favicon editor" className="space-y-4 p-4 md:p-5">
    {!preview && <fieldset disabled={disabled} className="max-w-xl space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-lg font-semibold">Favicon</legend>
      <label className="block space-y-2 text-xs font-semibold">
        <span>Favicon image URL</span>
        <input type="url" maxLength={2048} value={faviconUrl} onChange={event => onChange(event.target.value)}
          aria-describedby="favicon-help" className="min-h-11 w-full rounded-lg border border-[#171715]/20 bg-white px-3 py-2 text-sm" />
      </label>
      <p id="favicon-help" className="text-xs leading-5 text-[#171715]/70">Use a public HTTPS link to a square PNG or ICO image. The favicon appears in browser tabs. Save and publish to make it live.</p>
      <button type="button" disabled={!faviconUrl} onClick={() => onChange("")}
        className="min-h-11 rounded-lg border border-[#171715]/20 px-3 text-xs font-semibold disabled:opacity-60">Use default Kessick icon</button>
    </fieldset>}
    <div className="space-y-2">
      <p className="text-xs font-semibold">Browser tab preview</p>
      <div className="inline-flex items-center gap-2 rounded-t-lg border border-[#171715]/15 bg-[#f0f1f2] px-3 py-2 text-sm">
        <img key={previewUrl} src={previewUrl} alt="" width={16} height={16}
          onError={event => { if (event.currentTarget.getAttribute("src") !== defaultIcon) event.currentTarget.src = defaultIcon; }} />
        Kessick Dealer Portal
      </div>
    </div>
  </section>;
}

export function PublicBrandingPreview({ branding, page }: { branding: PortalPublicBranding; page: "sign-in" | "welcome" }) {
  // Inert presentation avoids starting a real sign-in or navigating out of an editor.
  return <div inert aria-label={`${page === "sign-in" ? "Sign-in" : "Welcome"} design preview`}>
    {page === "welcome" ? <PublicWelcome branding={branding} /> : <AuthLayout signIn title={branding.signInTitle} description={branding.signInDescription} logoSrc={goldKLogo} branding={branding}>
      <div className="space-y-5 p-6 sm:p-8">
        <button type="button" disabled className="min-h-11 w-full border border-white/25 bg-[#242420] px-4 text-sm text-[#f3f0e8]">Continue with Google</button>
        <p className="text-center text-xs text-[#b9b7af]">or</p>
        <label className="block space-y-2 text-sm text-[#e3e0d8]">Email address<input disabled type="email" placeholder="Enter your email address" className="min-h-11 w-full border border-white/25 bg-[#242420] px-3 text-base text-[#f3f0e8]" /></label>
        <button type="button" disabled className="min-h-11 w-full bg-[#c9af76] px-4 text-sm font-semibold text-[#17150f]">Continue</button>
      </div>
    </AuthLayout>}
  </div>;
}
