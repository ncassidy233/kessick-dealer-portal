import { useEffect, useState } from "react";
import {
  getGetAccountQueryKey,
  useUpdateAccount,
} from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { portalSessionKey, usePortalSession } from "@/lib/portal-session";

type AssignedRep = {
  id: string;
  email: string;
  displayName?: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function PortalAccount() {
  const sessionQuery = usePortalSession();
  const updateAccount = useUpdateAccount();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (sessionQuery.data?.account) {
      setDisplayName(sessionQuery.data.account.displayName || "");
    }
  }, [sessionQuery.data?.account.displayName]);

  if (sessionQuery.isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#B39862]" />
      </div>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="p-6 md:p-10">
        <div className="mx-auto flex max-w-2xl items-start gap-3 border border-[#8b382b]/30 bg-[#8b382b]/5 p-5 text-[#8b382b]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-medium">Account details are unavailable</h2>
            <p className="mt-1 text-sm">
              {errorMessage(sessionQuery.error ?? new Error("Portal session not found."))}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { account, role, groups } = sessionQuery.data;
  const assignedRep = (account as typeof account & { assignedRep?: AssignedRep | null }).assignedRep;
  const isApproved = account.status === "approved";
  const hasChanges = displayName !== (account.displayName || "");

  const saveProfile = () => {
    updateAccount.mutate(
      { data: { displayName: displayName.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
          queryClient.invalidateQueries({ queryKey: portalSessionKey });
          toast.success("Profile updated");
        },
        onError: (error) => toast.error(`Failed to update profile: ${errorMessage(error)}`),
      },
    );
  };

  return (
    <div className="flex h-full w-full max-w-5xl flex-col space-y-8 p-6 md:mx-auto md:p-10">
      <header className="shrink-0 space-y-2 border-b border-[#121210]/10 pb-6">
        <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-[#121210]">
          <User className="h-8 w-8 text-[#B39862]" />
          Account
        </h1>
        <p className="text-[#121210]/60">
          Manage your profile and view dealership assignments.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="space-y-6 border border-[#121210]/10 bg-white p-6">
            <h2 className="text-xl font-light text-[#121210]">Profile Details</h2>
            <div className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#121210]/50">
                  Email Address
                </label>
                <Input
                  value={account.email}
                  disabled
                  className="rounded-none border-[#121210]/10 bg-[#121210]/[0.035] text-[#121210]/70"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="display-name"
                  className="text-[10px] font-semibold uppercase tracking-widest text-[#121210]/50"
                >
                  Display Name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Enter your name"
                  className="rounded-none border-[#121210]/20 bg-white text-[#121210] focus-visible:ring-[#B39862]"
                />
              </div>
              <Button
                onClick={saveProfile}
                disabled={updateAccount.isPending || !hasChanges}
                className="rounded-none bg-[#121210] text-[#F3F0E8] hover:bg-[#121210]/85"
              >
                {updateAccount.isPending ? "Saving…" : "Save Changes"}
              </Button>
              {updateAccount.error && (
                <p className="border border-[#8b382b]/30 bg-[#8b382b]/5 p-3 text-sm text-[#8b382b]">
                  {errorMessage(updateAccount.error)}
                </p>
              )}
            </div>
          </section>

          {groups.length > 0 && (
            <section className="space-y-6 border border-[#121210]/10 bg-white p-6">
              <h2 className="text-xl font-light text-[#121210]">
                Assigned Dealership Groups
              </h2>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <Badge
                    key={group.id}
                    variant="outline"
                    className="rounded-none border-[#B39862] bg-[#B39862]/5 px-3 py-1 text-sm font-medium text-[#806936]"
                  >
                    {group.name}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {assignedRep && (
            <section className="space-y-4 border border-[#B39862]/30 bg-[#B39862]/5 p-6">
              <h2 className="flex items-center gap-2 text-xl font-light text-[#121210]">
                <Briefcase className="h-5 w-5 text-[#B39862]" />
                Your Kessick Representative
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center border border-[#B39862]/30 bg-white">
                  <User className="h-6 w-6 text-[#B39862]" />
                </div>
                <div>
                  <div className="font-medium text-[#121210]">
                    {assignedRep.displayName || assignedRep.email}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Mail className="h-3 w-3 text-[#121210]/50" />
                    <a
                      href={`mailto:${assignedRep.email}`}
                      className="text-xs text-[#121210]/70 hover:text-[#806936] hover:underline"
                    >
                      {assignedRep.email}
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="border border-[#121210]/10 bg-white p-6">
            <h2 className="mb-6 border-b border-[#121210]/5 pb-2 text-sm font-semibold uppercase tracking-widest text-[#121210]/50">
              Account Status
            </h2>
            <div className="space-y-5">
              <div>
                <div className="mb-1 text-xs uppercase tracking-widest text-[#121210]/50">
                  Role
                </div>
                <div className="text-lg font-medium capitalize text-[#121210]">{role}</div>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-widest text-[#121210]/50">
                  Status
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {isApproved ? (
                    <Badge className="rounded-none bg-[#121210] px-2 py-1 text-white">
                      <CheckCircle2 className="mr-1.5 h-3 w-3" /> Approved
                    </Badge>
                  ) : account.status === "pending" ? (
                    <Badge
                      variant="outline"
                      className="rounded-none border-[#121210]/20 px-2 py-1 text-[#121210]"
                    >
                      <Clock className="mr-1.5 h-3 w-3" /> Pending
                    </Badge>
                  ) : (
                    <Badge className="rounded-none bg-[#8b382b] px-2 py-1 text-white">
                      <ShieldAlert className="mr-1.5 h-3 w-3" /> Suspended
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </section>

          <Button
            variant="outline"
            className="h-12 w-full justify-start rounded-none border-[#121210]/10 text-[#8b382b] hover:bg-[#8b382b]/5 hover:text-[#8b382b]"
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}