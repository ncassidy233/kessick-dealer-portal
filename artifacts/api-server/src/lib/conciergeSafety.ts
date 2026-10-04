export type GroundedCitation = { sourceId: string; quote: string };

export function filterAuthorizedCitations(
  citations: GroundedCitation[],
  authorizedSources: ReadonlyMap<string, string>,
): GroundedCitation[] {
  return citations.filter(
    (citation) =>
      citation.quote.trim().length > 0 &&
      (authorizedSources.get(citation.sourceId) ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .includes(citation.quote.trim().toLowerCase().replace(/\s+/g, " ")),
  );
}

export function groundedStatus(
  status: "answered" | "partial" | "unknown",
  citations: GroundedCitation[],
): "answered" | "partial" | "unknown" {
  return status === "answered" && citations.length === 0 ? "unknown" : status;
}

export function isExplicitRenameRequest(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    /\brename\b/.test(normalized) &&
    /\bproject\b/.test(normalized) &&
    /\b(to|as)\b/.test(normalized)
  );
}

export function projectFactStatus(
  project: unknown,
): "concept" | "reviewed" | "approved" {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return "concept";
  }
  const snapshot = (project as Record<string, unknown>).snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "concept";
  }
  const projectRecord = (snapshot as Record<string, unknown>).project;
  if (
    !projectRecord ||
    typeof projectRecord !== "object" ||
    Array.isArray(projectRecord)
  ) {
    return "concept";
  }
  const record = projectRecord as Record<string, unknown>;
  const explicit = [
    record.approvalStatus,
    record.reviewStatus,
    record.status,
  ].find((value): value is string => typeof value === "string");
  const normalized = explicit?.trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "reviewed") return "reviewed";
  return "concept";
}

const UNKNOWN_ANSWER =
  "I don't have enough authorized Kessick source information to answer that. The missing fact is unknown; no project change was made.";

export function renderValidatedAnswer(
  citations: GroundedCitation[],
  modelAnswer: string,
  request: string,
): { answer: string; status: "answered" | "partial" | "unknown" } {
  if (citations.length === 0) {
    return { answer: UNKNOWN_ANSWER, status: "unknown" };
  }
  const facts = citations.map((citation) => `• ${citation.quote}`).join("\n");
  const asksForDraft = /\b(draft|follow[- ]?up|email|message|questions?)\b/i.test(
    request,
  );
  let answer = facts;
  if (
    asksForDraft &&
    modelAnswer.length <= 700 &&
    !/\b\d+(?:\.\d+)?\s*(?:in|inch|inches|mm|cm|usd|\$)|\$\s*\d|\b(?:approved|approval|price|pricing|cost|manufactur)/i.test(
      modelAnswer,
    )
  ) {
    answer += `\n\nDraft for review (not a Kessick fact):\n${modelAnswer.trim()}`;
  }
  return { answer, status: "answered" };
}