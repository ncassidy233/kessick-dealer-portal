import { useState } from "react";
import { useGetAccount, useUpdateAccount, useCreateDealerApplication, useListOrganizationMembers, useCreateOrganizationMember, useUpdateOrganizationMember, useAcceptCurrentOrganizationMembership, useDeclineCurrentOrganizationMembership, useListDealerOrganizationsForStaff, useUpdateDealerOrganizationStatus, OrganizationMember, Organization, getGetAccountQueryKey, getListOrganizationMembersQueryKey } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/brand-logo";
import { Link } from "wouter";
import { ArrowLeft, LogOut, CheckCircle2, ShieldAlert, Clock, User, Briefcase, Plus, Loader2 } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

export default function AccountPage() {
  const { data: accountContext, isLoading } = useGetAccount();
  const { signOut } = useClerk();
  
  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accountContext) return null;

  const { account, organization, membership } = accountContext;
  
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative overflow-y-auto no-scrollbar">
      <div className="absolute inset-0 bg-canvas-pattern opacity-[0.03] pointer-events-none" />
      
      <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/workspace" className="flex items-center shrink-0 hover:opacity-80 transition-opacity">
            <BrandLogo tone="light" className="h-6 w-auto" showWineCellarsName />
          </Link>
        </div>
        <Link href="/workspace" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workspace
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center py-12 px-4 z-10 w-full">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex flex-col md:flex-row gap-6 md:items-start">
            
            <div className="flex-1 space-y-6">
              <ProfileSettings account={account} />
              
              {account.role === 'customer' && organization && membership?.status === 'pending' && (
                <PendingDealerTeamInvitation
                  organization={organization}
                  membership={membership}
                />
              )}

              {account.role === 'customer' && !organization && (
                <DealerApplication />
              )}
              
              {account.role === 'dealer' && organization && membership && (
                <DealerTeamManagement organization={organization!} membership={membership!} />
              )}
              
              {account.role === 'staff' && (
                <StaffDealerApprovals />
              )}
            </div>
            
            <div className="w-full md:w-64 space-y-4">
              <div className="p-4 border border-border bg-card">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Account Status</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="font-medium capitalize">{account.role}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="flex items-center gap-2 mt-1">
                      {account.status === 'approved' ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30 rounded-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>
                      ) : account.status === 'pending' ? (
                        <Badge variant="outline" className="rounded-none"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                      ) : (
                        <Badge variant="destructive" className="rounded-none"><ShieldAlert className="w-3 h-3 mr-1" /> Suspended</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive border-border rounded-none" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileSettings({ account }: { account: any }) {
  const updateAccount = useUpdateAccount();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(account.displayName || '');

  const handleSave = () => {
    updateAccount.mutate({
      data: { displayName }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
        toast.success("Profile updated");
      },
      onError: () => toast.error("Failed to update profile")
    });
  };

  return (
    <div className="p-6 border border-border bg-card">
      <h2 className="text-lg font-medium flex items-center gap-2 mb-4 border-b border-border pb-4">
        <User className="w-5 h-5 text-primary" /> Profile Settings
      </h2>
      
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <Input value={account.email} disabled className="mt-1 rounded-none bg-muted/50" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Display Name</label>
          <Input 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
            className="mt-1 rounded-none bg-input"
            placeholder="How you appear to others"
          />
        </div>
        <Button onClick={handleSave} disabled={updateAccount.isPending} className="rounded-none bg-primary text-primary-foreground">
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function DealerApplication() {
  const createDealerApp = useCreateDealerApplication();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState('');
  
  const handleApply = () => {
    if (!orgName.trim()) {
      toast.error("Company name required");
      return;
    }
    createDealerApp.mutate({
      data: { organizationName: orgName }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
        toast.success("Application submitted for Kessick review.");
      },
      onError: () => toast.error("Failed to submit application")
    });
  };
  
  return (
    <div className="p-6 border border-border bg-card">
      <h2 className="text-lg font-medium flex items-center gap-2 mb-4 border-b border-border pb-4">
        <Briefcase className="w-5 h-5 text-primary" /> Become a Dealer
      </h2>
      
      <p className="text-sm text-muted-foreground mb-4">
        Apply to become an authorized Kessick dealer to access wholesale pricing, team management, and advanced features.
      </p>
      
      <div className="flex gap-2 max-w-md">
        <Input 
          value={orgName} 
          onChange={e => setOrgName(e.target.value)} 
          placeholder="Your Company Name"
          className="rounded-none bg-input"
        />
        <Button onClick={handleApply} disabled={createDealerApp.isPending} className="rounded-none bg-primary text-primary-foreground">
          Apply Now
        </Button>
      </div>
    </div>
  );
}

function PendingDealerTeamInvitation({
  organization,
  membership,
}: {
  organization: Organization;
  membership: OrganizationMember;
}) {
  const acceptMembership = useAcceptCurrentOrganizationMembership();
  const declineMembership = useDeclineCurrentOrganizationMembership();
  const queryClient = useQueryClient();

  const refreshAccount = () =>
    queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });

  return (
    <div className="p-6 border border-primary/40 bg-primary/5">
      <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
        <Briefcase className="w-5 h-5 text-primary" />
        Dealer team invitation
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        <strong className="text-foreground">{organization.name}</strong> invited
        your verified account to join its Kessick dealer workspace as a{' '}
        {membership.membershipRole}. Accept only if you recognize this company.
      </p>
      <div className="flex gap-2">
        <Button
          className="rounded-none"
          disabled={acceptMembership.isPending || declineMembership.isPending}
          onClick={() => acceptMembership.mutate(undefined, {
            onSuccess: () => {
              refreshAccount();
              toast.success('Dealer team invitation accepted.');
            },
            onError: () => toast.error('The dealer invitation could not be accepted.'),
          })}
        >
          Accept invitation
        </Button>
        <Button
          variant="outline"
          className="rounded-none"
          disabled={acceptMembership.isPending || declineMembership.isPending}
          onClick={() => declineMembership.mutate(undefined, {
            onSuccess: () => {
              refreshAccount();
              toast.success('Dealer team invitation declined.');
            },
            onError: () => toast.error('The dealer invitation could not be declined.'),
          })}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

function DealerTeamManagement({ organization, membership }: { organization: Organization, membership: OrganizationMember }) {
  const { data: members } = useListOrganizationMembers();
  const createMember = useCreateOrganizationMember();
  const updateMember = useUpdateOrganizationMember();
  const queryClient = useQueryClient();
  const [memberEmail, setMemberEmail] = useState('');
  const isOwner = membership.membershipRole === 'owner';

  const refreshMembers = () =>
    queryClient.invalidateQueries({ queryKey: getListOrganizationMembersQueryKey() });

  const addMember = () => {
    createMember.mutate(
      { data: { email: memberEmail, membershipRole: 'member' } },
      {
        onSuccess: () => {
          setMemberEmail('');
          refreshMembers();
          toast.success('Dealer team invitation created.');
        },
        onError: () => toast.error('That verified account could not be added.'),
      },
    );
  };
  
  if (!members) return <div className="p-6 border border-border bg-card">Loading team...</div>;
  
  return (
    <div className="p-6 border border-border bg-card">
      <div className="flex justify-between items-center mb-4 border-b border-border pb-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" /> {organization.name}
        </h2>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="rounded-none capitalize">{organization.status}</Badge>
          <Badge className="bg-primary/20 text-primary border-primary/30 rounded-none capitalize">{membership.membershipRole}</Badge>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Team Members</h3>
        {isOwner && (
          <div className="flex gap-2">
            <Input
              type="email"
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="Verified account email"
              className="rounded-none bg-input"
            />
            <Button
              onClick={addMember}
              disabled={!memberEmail.includes('@') || createMember.isPending}
              className="rounded-none"
            >
              Add
            </Button>
          </div>
        )}
        
        <div className="border border-border divide-y divide-border">
          {members.map(m => (
            <div key={m.id} className="p-3 flex justify-between items-center bg-background/50 hover:bg-muted/30">
              <div>
                <div className="font-medium text-sm">{m.displayName || m.email}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className="text-[10px] rounded-none capitalize">{m.status}</Badge>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.membershipRole}</span>
                {isOwner && m.id !== membership.id && m.status !== 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none"
                    disabled={updateMember.isPending}
                    onClick={() => updateMember.mutate(
                      {
                        membershipId: m.id,
                        data: { status: m.status === 'approved' ? 'suspended' : 'approved' },
                      },
                      { onSuccess: refreshMembers },
                    )}
                  >
                    {m.status === 'approved' ? 'Suspend' : 'Approve'}
                  </Button>
                )}
                {m.status === 'pending' && (
                  <span className="text-[10px] text-muted-foreground">
                    Awaiting acceptance
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StaffDealerApprovals() {
  const { data: orgs, refetch } = useListDealerOrganizationsForStaff();
  const updateStatus = useUpdateDealerOrganizationStatus();
  
  const handleStatus = (orgId: string, status: 'approved' | 'suspended') => {
    updateStatus.mutate({
      organizationId: orgId,
      data: { status }
    }, {
      onSuccess: () => {
        toast.success(status === 'approved' ? "Dealer approved" : "Dealer suspended");
        refetch();
      }
    });
  };
  
  if (!orgs) return null;
  const pendingOrgs = orgs.filter(o => o.status === 'pending');
  
  return (
    <div className="p-6 border border-border bg-card">
      <h2 className="text-lg font-medium flex items-center gap-2 mb-4 border-b border-border pb-4">
        <ShieldAlert className="w-5 h-5 text-primary" /> Pending Dealer Applications
      </h2>
      
      {pendingOrgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending applications.</p>
      ) : (
        <div className="space-y-3">
          {pendingOrgs.map(o => (
            <div key={o.id} className="p-3 border border-border flex justify-between items-center bg-background/50">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">Applied {new Date(o.createdAt).toLocaleDateString()}</div>
              </div>
              <Button size="sm" className="rounded-none bg-primary text-primary-foreground" onClick={() => handleStatus(o.id, 'approved')}>
                Approve
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}