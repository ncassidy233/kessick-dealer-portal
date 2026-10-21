/*
 * Saved dealer searches.
 *
 * Every search a dealer commits to is kept, with whether it found anything
 * and what they opened. The unanswered ones show what dealers need that the
 * portal doesn't cover yet, and the whole log becomes source material for
 * the Kessick Concierge later.
 *
 * Today the log lives on the dealer's device. When the portal runs on the
 * API with sign-in, the same entries post to the server so Kessick can
 * review them across all dealers.
 */

export type SearchLogEntry = {
  query: string;
  results: number;
  /** Title of the answer or page the dealer opened, if any. */
  picked?: string;
  at: string;
};

const KEY = "kessick-portal:search-log";
const MAX_ENTRIES = 300;

export function readSearchLog(): SearchLogEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: SearchLogEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Storage can be unavailable (private mode); search still works.
  }
  window.dispatchEvent(new Event("kessick-search-log"));
}

const normalize = (q: string) => q.trim().replace(/\s+/g, " ");

/**
 * Records a search. Typing refines a query, so a new query that extends the
 * previous one within a minute replaces it rather than adding a near-duplicate.
 */
export function recordSearch(query: string, results: number, picked?: string) {
  const q = normalize(query);
  if (q.length < 2) return;
  const entries = readSearchLog();
  const last = entries[entries.length - 1];
  const now = new Date();
  const recent = last && now.getTime() - new Date(last.at).getTime() < 60_000;
  const lastQ = last?.query.toLowerCase() ?? "";
  const lower = q.toLowerCase();
  const refines = recent && (lower.startsWith(lastQ) || lastQ.startsWith(lower));
  const entry: SearchLogEntry = {
    query: q,
    results,
    picked: picked ?? (refines && lastQ === lower ? last.picked : undefined),
    at: now.toISOString(),
  };
  if (refines) entries[entries.length - 1] = entry;
  else entries.push(entry);
  write(entries);
}

export function clearSearchLog() {
  write([]);
}

/** Most recent distinct queries, newest first. */
export function recentQueries(limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of readSearchLog().reverse()) {
    const key = e.query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e.query);
    if (out.length === limit) break;
  }
  return out;
}

/** Plain-text export for sending to Kessick. */
export function searchLogText(entries = readSearchLog()) {
  return entries
    .map(
      (e) =>
        `${e.at.slice(0, 16).replace("T", " ")}  "${e.query}"  ${
          e.results ? `${e.results} result${e.results === 1 ? "" : "s"}` : "NO RESULTS"
        }${e.picked ? `  -> ${e.picked}` : ""}`,
    )
    .join("\n");
}
