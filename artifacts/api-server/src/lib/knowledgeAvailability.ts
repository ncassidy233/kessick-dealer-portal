export const KNOWLEDGE_UNAVAILABLE_NOTICE = "The knowledge library is temporarily unavailable. This answer uses only other authorized sources.";
export class KnowledgeUnavailableError extends Error {
  constructor() {
    super("Knowledge library unavailable: its database migration must be applied before use.");
    this.name = "KnowledgeUnavailableError";
  }
}
/** Drizzle wraps PostgreSQL errors in `cause`; never swallow unrelated DB errors. */
export function isMissingKnowledgeSchema(error: unknown): boolean {
  let current = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i++) {
    const value = current as { code?: string; cause?: unknown };
    if (value.code === "42P01" || value.code === "42703") return true;
    current = value.cause;
  }
  return false;
}
export async function knowledgeSchemaOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (isMissingKnowledgeSchema(error)) throw new KnowledgeUnavailableError();
    throw error;
  }
}