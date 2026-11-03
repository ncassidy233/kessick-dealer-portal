import { Redirect } from "wouter";
import { useClerk } from "@clerk/react";
import { usePortalSession } from "@/lib/portal-session";
import { accountHome } from "@/lib/account-home";
import { basePath } from "@/App";

export default function ContinuePage() {
  const session = usePortalSession();
  const { signOut } = useClerk();
  if (session.isLoading || (session.isFetching && session.failureCount > 0)) return <main role="status" className="grid min-h-[100dvh] place-items-center bg-[#121210] p-6 text-[#f3f0e8]">Opening your workspace…</main>;
  if (session.isError || !session.data) return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#121210] p-6 text-center text-[#f3f0e8]">
      <h1 className="font-serif text-3xl">Unable to open your workspace</h1>
      <p className="mt-3 text-sm text-[#c4c1b8]">Your account could not be verified. Try again or sign in with a different account.</p>
      <button className="mt-6 min-h-11 border border-[#c9af76] px-6 text-[#e2c991]" disabled={session.isFetching} onClick={() => void session.refetch()}>Try again</button>
      <button className="mt-3 min-h-11 underline" onClick={() => void signOut({ redirectUrl: `${basePath}/sign-in` })}>Sign out</button>
    </main>
  );
  return <Redirect to={accountHome(session.data)} />;
}
