import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock3,
  Coins,
  History,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useConcierge } from "@/hooks/use-concierge";
import { ConciergeAction, ConciergeFactStatus, ConciergeMessage } from "@/lib/concierge-api";
import type { Project } from "@workspace/api-client-react";

const STATUS_STYLE: Record<ConciergeFactStatus, string> = {
  concept: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  reviewed: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  unknown: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
};

const PROJECT_PROMPTS = [
  "Summarize this site survey and label any unknowns.",
  "What information is missing before a design review?",
  "Compare the project options using cited facts only.",
  "Draft follow-up questions for the customer.",
];

const WORKSPACE_PROMPTS = [
  "Explain which authorized products fit a narrow wall.",
  "Summarize my recently updated projects.",
  "What facts should I gather during a site survey?",
  "Explain the difference between concept, reviewed, and approved.",
];

function StatusBadge({ status }: { status: ConciergeFactStatus }) {
  return (
    <span className={`inline-flex border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function SuggestedAction({
  action,
  isConfirming,
  canConfirm,
  onReview,
}: {
  action: ConciergeAction;
  isConfirming: boolean;
  canConfirm: boolean;
  onReview: () => void;
}) {
  return (
    <div className="mt-3 border border-primary/30 bg-background/60 p-3" data-testid={`card-concierge-action-${action.id}`}>
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Suggested project action</p>
          <p className="mt-1 text-sm font-medium">{action.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
          {action.effects && action.effects.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {action.effects.map((effect, index) => <li key={index}>{effect}</li>)}
            </ul>
          )}
        </div>
      </div>
      {action.status === "suggested" && canConfirm ? (
        <Button
          data-testid={`button-review-concierge-action-${action.id}`}
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={isConfirming}
          onClick={onReview}
        >
          Review before applying
        </Button>
      ) : action.status === "suggested" ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          An authorized dealer or staff user must review and confirm this action.
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`status-concierge-action-${action.id}`}>
          {action.status === "confirmed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {action.status === "confirmed" ? "Confirmed by a user" : action.status}
        </p>
      )}
    </div>
  );
}

function Message({
  message,
  confirmingActionId,
  canConfirmActions,
  onReviewAction,
}: {
  message: ConciergeMessage;
  confirmingActionId: string | null;
  canConfirmActions: boolean;
  onReviewAction: (action: ConciergeAction) => void;
}) {
  const assistant = message.role === "assistant";
  return (
    <article className={`flex gap-3 ${assistant ? "" : "justify-end"}`} data-testid={`message-concierge-${message.id}`}>
      {assistant && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-primary/40 bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[88%] border p-3 ${assistant ? "border-border bg-card" : "border-primary/30 bg-primary/10"}`}>
        {assistant && message.factStatus && <div className="mb-2"><StatusBadge status={message.factStatus} /></div>}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        {assistant && message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3 w-3" /> Sources
            </p>
            <ol className="space-y-1.5">
              {message.citations.map((citation, index) => (
                <li className="flex items-start gap-2 text-xs" key={citation.id ?? index}>
                  <span className="text-primary">[{index + 1}]</span>
                  <div>
                    {citation.url ? (
                      <a
                        data-testid={`link-concierge-citation-${message.id}-${index}`}
                        href={citation.url.startsWith("https://") || citation.url.startsWith("http://") || citation.url.startsWith("/") ? citation.url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline decoration-primary/50 underline-offset-2 hover:text-primary"
                      >
                        {citation.label}
                      </a>
                    ) : <span>{citation.label}</span>}
                    {citation.factStatus && <span className="ml-2"><StatusBadge status={citation.factStatus} /></span>}
                    {citation.detail && <p className="mt-0.5 text-muted-foreground">{citation.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {assistant && message.actions?.map((action) => (
          <SuggestedAction
            key={action.id}
            action={action}
            isConfirming={confirmingActionId === action.id}
            canConfirm={canConfirmActions}
            onReview={() => onReviewAction(action)}
          />
        ))}
      </div>
    </article>
  );
}

export function ConciergePanel({
  open,
  onOpenChange,
  projectId,
  projectName,
  canConfirmActions = false,
  onProjectConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
  canConfirmActions?: boolean;
  onProjectConfirmed?: (
    project: Project,
    previousName: string | undefined,
    actionProjectVersion: number,
  ) => void;
}) {
  const concierge = useConcierge(projectId, open, onProjectConfirmed);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<ConciergeAction | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prompts = projectId ? PROJECT_PROMPTS : WORKSPACE_PROMPTS;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [concierge.messages, concierge.isSending]);

  const submit = async () => {
    const content = draft;
    if (!content.trim()) return;
    setDraft("");
    const sent = await concierge.sendMessage(content);
    if (!sent) setDraft(content);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 border-l border-primary/20 bg-background p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-card px-5 py-4 pr-12 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-primary/50 bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="font-light tracking-wide">Kessick Concierge</SheetTitle>
                <SheetDescription>
                  {projectId ? `Project guidance · ${projectName || "Current project"}` : "Catalog and workspace guidance"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1">
            <aside className={`${historyOpen ? "absolute inset-y-0 left-0 z-20 flex w-[82%]" : "hidden"} top-[73px] flex-col border-r border-border bg-sidebar md:static md:flex md:w-52`}>
              <div className="flex items-center gap-2 border-b border-border p-3">
                <Button data-testid="button-new-concierge-conversation" variant="outline" size="sm" className="flex-1 justify-start" onClick={() => { concierge.startNewConversation(); setHistoryOpen(false); }}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> New chat
                </Button>
                <Button data-testid="button-close-concierge-history" variant="ghost" size="icon" className="md:hidden" onClick={() => setHistoryOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {concierge.isLoadingHistory ? (
                    <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading history</p>
                  ) : concierge.conversations.length === 0 ? (
                    <p className="p-2 text-xs leading-relaxed text-muted-foreground">No previous conversations in this context.</p>
                  ) : concierge.conversations.map((conversation) => (
                    <button
                      data-testid={`button-concierge-conversation-${conversation.id}`}
                      key={conversation.id}
                      onClick={() => { concierge.setActiveId(conversation.id); setHistoryOpen(false); }}
                      className={`w-full border px-2.5 py-2 text-left text-xs transition-colors ${concierge.activeId === conversation.id ? "border-primary/40 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
                    >
                      <span className="line-clamp-2">{conversation.title || "Untitled conversation"}</span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] opacity-70"><Clock3 className="h-2.5 w-2.5" /> {new Date(conversation.updatedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
                <Button data-testid="button-open-concierge-history" variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
                  <History className="mr-2 h-4 w-4" /> History
                </Button>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Private workspace context</span>
              </div>

              <ScrollArea className="flex-1">
                <div className="mx-auto max-w-xl space-y-5 px-4 py-5">
                  {concierge.isLoadingMessages ? (
                    <div className="flex flex-col items-center py-12 text-muted-foreground" data-testid="status-concierge-loading">
                      <Loader2 className="mb-3 h-5 w-5 animate-spin text-primary" />
                      <p className="text-sm">Loading conversation…</p>
                    </div>
                  ) : concierge.messages.length === 0 ? (
                    <div>
                      <div className="border border-primary/20 bg-card p-5">
                        <p className="text-lg font-light">How can I help?</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          I can explain authorized catalog and accessible project information, summarize surveys, compare options, and draft text.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {prompts.map((prompt, index) => (
                            <button
                              data-testid={`button-concierge-prompt-${index}`}
                              key={prompt}
                              onClick={() => setDraft(prompt)}
                              className="border border-border bg-background p-3 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                        {(["concept", "reviewed", "approved", "unknown"] as ConciergeFactStatus[]).map((status) => (
                          <div className="flex items-center gap-2 border border-border px-2 py-1.5" key={status}>
                            <StatusBadge status={status} />
                            <span className="text-muted-foreground">
                              {status === "concept" ? "Dealer proposal" : status === "reviewed" ? "Kessick reviewed" : status === "approved" ? "Explicitly approved" : "Not in sources"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : concierge.messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      confirmingActionId={concierge.confirmingActionId}
                      canConfirmActions={canConfirmActions}
                      onReviewAction={setActionToConfirm}
                    />
                  ))}

                  {concierge.isSending && (
                    <div className="flex gap-3" data-testid="status-concierge-thinking">
                      <div className="flex h-7 w-7 items-center justify-center border border-primary/40 bg-primary/10"><Bot className="h-4 w-4 text-primary" /></div>
                      <div className="flex items-center gap-2 border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Checking authorized sources…
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-border bg-card p-3">
                {concierge.error && (
                  <div role="alert" data-testid="status-concierge-error" className="mb-3 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-2.5 text-xs">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="flex-1"><p>{concierge.error}</p><button data-testid="button-retry-concierge" className="mt-1 text-primary underline" onClick={() => void concierge.retry()}>Retry</button></div>
                  </div>
                )}
                <div className="mb-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Sending uses Replit AI credits and may take a moment. AI can be wrong; verify dimensions, pricing, and approvals against cited Kessick records.</span>
                </div>
                <div className="flex items-end gap-2 border border-border bg-background p-2 focus-within:border-primary/60">
                  <Textarea
                    data-testid="input-concierge-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                      }
                    }}
                    disabled={concierge.isSending}
                    maxLength={4000}
                    rows={2}
                    placeholder={projectId ? "Ask about this project…" : "Ask about your workspace or the catalog…"}
                    className="min-h-12 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
                  />
                  <Button
                    data-testid="button-send-concierge-message"
                    size="icon"
                    aria-label="Send message using AI credits"
                    disabled={!draft.trim() || concierge.isSending}
                    onClick={() => void submit()}
                  >
                    {concierge.isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Concierge cannot provide engineering approval, submit orders, accept quotes, or message customers on its own.
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!actionToConfirm} onOpenChange={(next) => !next && setActionToConfirm(null)}>
        <AlertDialogContent className="border-primary/30 bg-card">
          <AlertDialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center border border-primary/40 bg-primary/10"><ShieldCheck className="h-5 w-5 text-primary" /></div>
            <AlertDialogTitle>Confirm suggested project action</AlertDialogTitle>
            <AlertDialogDescription>
              Review this suggestion carefully. Nothing changes unless you explicitly confirm, and this confirmation is not Kessick engineering approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionToConfirm && (
            <div className="border border-border bg-background p-3">
              <p className="font-medium">{actionToConfirm.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{actionToConfirm.description}</p>
              {actionToConfirm.effects?.map((effect, index) => <p className="mt-2 text-xs text-muted-foreground" key={index}>• {effect}</p>)}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-concierge-action">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-concierge-action"
              disabled={!!concierge.confirmingActionId}
              onClick={(event) => {
                event.preventDefault();
                if (!actionToConfirm) return;
                void concierge.confirmAction(actionToConfirm).then((confirmed) => {
                  if (confirmed) setActionToConfirm(null);
                });
              }}
            >
              {concierge.confirmingActionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm and apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}