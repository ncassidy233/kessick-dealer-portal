import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  type Project,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConciergeAction,
  ConciergeApiError,
  ConciergeConversation,
  ConciergeMessage,
  confirmConciergeAction,
  createConciergeConversation,
  listConciergeConversations,
  listConciergeMessages,
  sendConciergeMessage,
} from "@/lib/concierge-api";

function friendlyError(error: unknown): string {
  if (error instanceof ConciergeApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session or project access changed. Refresh or sign in again.";
    }
    if (error.status === 429) return "The concierge usage limit was reached. Please try again later.";
    if (error.status === 408 || error.status === 504) {
      return "The concierge took too long to answer. No project changes were made.";
    }
    return `${error.message}. No project changes were made.`;
  }
  return "The concierge is unavailable. No project changes were made.";
}

export function useConcierge(
  projectId?: string,
  enabled = true,
  onProjectConfirmed?: (
    project: Project,
    previousName: string | undefined,
    actionProjectVersion: number,
  ) => void,
) {
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<ConciergeConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historySequence = useRef(0);
  const messageSequence = useRef(0);

  const loadHistory = useCallback(async () => {
    const sequence = ++historySequence.current;
    setIsLoadingHistory(true);
    setError(null);
    try {
      const next = await listConciergeConversations(projectId);
      if (sequence !== historySequence.current) return;
      setConversations(next);
      setActiveId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? null);
    } catch (cause) {
      if (sequence === historySequence.current) setError(friendlyError(cause));
    } finally {
      if (sequence === historySequence.current) setIsLoadingHistory(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!enabled) return;
    void loadHistory();
  }, [enabled, loadHistory]);

  useEffect(() => {
    if (!enabled || !activeId) {
      setMessages([]);
      return;
    }
    const sequence = ++messageSequence.current;
    setIsLoadingMessages(true);
    setError(null);
    listConciergeMessages(activeId)
      .then((next) => {
        if (sequence === messageSequence.current) setMessages(next);
      })
      .catch((cause) => {
        if (sequence === messageSequence.current) setError(friendlyError(cause));
      })
      .finally(() => {
        if (sequence === messageSequence.current) setIsLoadingMessages(false);
      });
  }, [activeId, enabled]);

  const startNewConversation = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return false;
    setIsSending(true);
    setError(null);
    let conversationId = activeId;
    const optimistic: ConciergeMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      if (!conversationId) {
        const created = await createConciergeConversation(projectId);
        conversationId = created.id;
        setConversations((current) => [created, ...current]);
      }
      const answer = await sendConciergeMessage(conversationId, trimmed);
      const persisted = await listConciergeMessages(conversationId).catch(() => null);
      setActiveId(conversationId);
      if (persisted) {
        setMessages(persisted);
      } else {
        setMessages((current) => [...current, answer]);
      }
      void loadHistory();
      return true;
    } catch (cause) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError(friendlyError(cause));
      return false;
    } finally {
      setIsSending(false);
    }
  }, [activeId, isSending, loadHistory, projectId]);

  const confirmAction = useCallback(async (action: ConciergeAction) => {
    if (!activeId || confirmingActionId) return false;
    setConfirmingActionId(action.id);
    setError(null);
    try {
      const previousProject = projectId
        ? queryClient.getQueryData<Project>(getGetProjectQueryKey(projectId))
        : undefined;
      const result = await confirmConciergeAction(activeId, action.id);
      queryClient.setQueryData<Project>(
        getGetProjectQueryKey(result.project.id),
        result.project,
      );
      queryClient.setQueryData<Project[]>(
        getListProjectsQueryKey(),
        (projects) =>
          projects?.map((project) =>
            project.id === result.project.id ? result.project : project,
          ),
      );
      onProjectConfirmed?.(
        result.project,
        previousProject?.name,
        result.action.expectedProjectVersion,
      );
      setMessages((current) => current.map((message) => ({
        ...message,
        actions: message.actions?.map((item) =>
          item.id === result.action.id ? result.action : item,
        ),
      })));
      return true;
    } catch (cause) {
      setError(friendlyError(cause));
      return false;
    } finally {
      setConfirmingActionId(null);
    }
  }, [
    activeId,
    confirmingActionId,
    onProjectConfirmed,
    projectId,
    queryClient,
  ]);

  return {
    conversations,
    activeId,
    messages,
    error,
    isLoadingHistory,
    isLoadingMessages,
    isSending,
    confirmingActionId,
    setActiveId,
    startNewConversation,
    sendMessage,
    confirmAction,
    retry: loadHistory,
  };
}