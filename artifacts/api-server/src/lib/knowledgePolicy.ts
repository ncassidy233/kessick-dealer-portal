export function knowledgeEligible(
  document: { status: string; audience: string; deletedAt?: unknown },
  audience: "staff" | "approved_dealers" | null,
) {
  return !document.deletedAt && document.status === "active" && audience !== null &&
    (audience === "staff" || document.audience === "approved_dealers");
}
export function canActivateKnowledge(document: { status: string; extractedText: string; errorMessage: string | null; deletedAt?: unknown }) {
  return document.status === "review" && !document.deletedAt && !document.errorMessage && Boolean(document.extractedText.trim());
}
export function knowledgeTerms(query: string): string[] {
  const stop = new Set(["what", "when", "where", "which", "with", "that", "this", "have", "does", "from", "about", "please", "could", "would"]);
  return [...new Set(query.toLowerCase().match(/[a-z0-9]{3,30}/g) ?? [])].filter(t => !stop.has(t)).slice(0, 12);
}
export function knowledgeSnippets(text: string, terms: string[]): string[] {
  const chunks = text.match(/[\s\S]{1,1200}/g) ?? [];
  return chunks.map((text, i) => ({ text, i, score: terms.reduce((n, t) => n + Number(text.toLowerCase().includes(t)), 0) }))
    .filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 2).map(c => c.text);
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function insightDates(from?: string, to?: string, now = new Date()) {
  const endDay = to ?? now.toISOString().slice(0, 10);
  const startDay = from ?? new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  for (const day of [startDay, endDay]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error("Use valid YYYY-MM-DD dates.");
  }
  const start = new Date(startDay), end = new Date(Date.parse(endDay) + 86400000);
  if (end <= start || end.getTime() - start.getTime() > 366 * 86400000) throw new Error("Choose an ordered date range of at most 366 days.");
  return { from: startDay, to: endDay, start, end };
}