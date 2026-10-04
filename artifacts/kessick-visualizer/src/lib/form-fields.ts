type BuilderField = { name: string; label: string; type: string; options?: string[] };

/** Mirrors linkedForms field constraints before staff send an atomic save. */
export function formFieldsError(fields: BuilderField[]): string | null {
  if (!fields.length || fields.length > 100) return "Forms need between 1 and 100 fields.";
  const names = new Set<string>();
  for (const [index, field] of fields.entries()) {
    const name = field.name.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || name.length > 120) return `Field ${index + 1} needs a unique key starting with a letter (letters, numbers, underscores; up to 120 characters).`;
    if (names.has(name)) return `Field keys must be unique: ${name}.`;
    names.add(name);
    if (!field.label.trim() || field.label.trim().length > 200) return `Field ${index + 1} needs a label of 1–200 characters.`;
    if (!["text", "email", "number", "date", "textarea", "select"].includes(field.type)) return `Field ${index + 1} has an unsupported type.`;
    if (field.type === "select" && (!field.options?.length || field.options.length > 100 || field.options.some((option) => !option.trim() || option.trim().length > 200))) return `Field ${index + 1} needs 1–100 nonempty choices of at most 200 characters each.`;
  }
  return null;
}