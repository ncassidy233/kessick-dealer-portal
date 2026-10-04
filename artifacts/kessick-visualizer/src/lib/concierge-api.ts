/**
 * The concierge API is intentionally isolated here while the OpenAPI client is
 * being generated. Keep endpoint or envelope alignment changes in this file.
 */
import type { Project } from "@workspace/api-client-react";

export type ConciergeFactStatus = "concept" | "reviewed" | "approved" | "unknown";

export interface ConciergeCitation {
  id?: string;
  label: string;
  detail?: string;
  url?: string;
  factStatus?: ConciergeFactStatus;
}

export interface ConciergeAction {
  id: string;
  title: string;
  description: string;
  effects?: string[];
  status: "suggested" | "confirmed" | "rejected" | "failed";
  requiresConfirmation?: boolean;
  expectedProjectVersion: number;
}

export interface ConciergeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  factStatus?: ConciergeFactStatus;
  citations?: ConciergeCitation[];
  actions?: ConciergeAction[];
}

export interface ConciergeConversation {
  id: string;
  title: string;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type ListEnvelope<T> = T[] | { items: T[] };
type MessageEnvelope = ConciergeMessage | { message: ConciergeMessage };
export interface ConfirmedConciergeAction {
  action: ConciergeAction;
  project: Project;
}

const API_ROOT = "/api/v1/concierge";

export class ConciergeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ConciergeApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { detail?: string; message?: string; error?: string };
      detail = body.detail || body.message || body.error || "";
    } catch {
      // The status-specific UI remains useful when an upstream returns no JSON.
    }
    throw new ConciergeApiError(detail || `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function unwrapList<T>(response: ListEnvelope<T>): T[] {
  return Array.isArray(response) ? response : response.items;
}

export async function listConciergeConversations(projectId?: string): Promise<ConciergeConversation[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return unwrapList(await request<ListEnvelope<ConciergeConversation>>(`/conversations${query}`));
}

export function createConciergeConversation(projectId?: string): Promise<ConciergeConversation> {
  return request("/conversations", {
    method: "POST",
    body: JSON.stringify(projectId ? { projectId } : {}),
  });
}

export async function listConciergeMessages(conversationId: string): Promise<ConciergeMessage[]> {
  return unwrapList(
    await request<ListEnvelope<ConciergeMessage>>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
    ),
  );
}

export async function sendConciergeMessage(
  conversationId: string,
  content: string,
): Promise<ConciergeMessage> {
  const response = await request<MessageEnvelope>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        acknowledgeCreditUsage: true,
      }),
    },
  );
  return "message" in response ? response.message : response;
}

export async function confirmConciergeAction(
  conversationId: string,
  actionId: string,
): Promise<ConfirmedConciergeAction> {
  return request<ConfirmedConciergeAction>(
    `/actions/${encodeURIComponent(actionId)}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({ conversationId, confirm: true }),
    },
  );
}