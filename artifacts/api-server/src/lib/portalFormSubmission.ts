import { z } from "zod";

const definition = z.object({
  name: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  type: z.enum(["text", "email", "number", "date", "textarea", "select"]),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).optional(),
});

export type SubmissionValidation =
  | { ok: true; values: Record<string, string | number> }
  | { ok: false; error: string; invalidDefinition?: boolean };

/** Treat persisted legacy definitions as untrusted; never store arbitrary client keys. */
export function validatePortalFormSubmission(definitions: unknown, values: unknown): SubmissionValidation {
  if (!Array.isArray(definitions) || !definitions.length || definitions.length > 100) {
    return { ok: false, error: "Form fields are not configured.", invalidDefinition: true };
  }
  const fields: Array<z.infer<typeof definition> & { key: string }> = [];
  const names = new Set<string>();
  for (const [index, raw] of definitions.entries()) {
    const parsed = definition.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Form contains an unsupported field.", invalidDefinition: true };
    const key = parsed.data.name || `field_${index + 1}`;
    if (names.has(key) || key === "__proto__" || key === "constructor" || key === "prototype" ||
      (parsed.data.type === "select" && !parsed.data.options?.length)) {
      return { ok: false, error: "Form contains invalid or duplicate fields.", invalidDefinition: true };
    }
    names.add(key);
    fields.push({ ...parsed.data, key });
  }
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return { ok: false, error: "Submission values must be an object." };
  }
  const supplied = values as Record<string, unknown>;
  if (Object.keys(supplied).some((key) => !names.has(key))) {
    return { ok: false, error: "Submission contains an unknown field." };
  }
  const accepted: Record<string, string | number> = Object.create(null);
  for (const field of fields) {
    const value = supplied[field.key];
    if (value === undefined || value === null || value === "") {
      if (field.required) return { ok: false, error: `Field "${field.label}" is required.` };
      continue;
    }
    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, error: `Field "${field.label}" must be a finite number.` };
      accepted[field.key] = value;
      continue;
    }
    if (typeof value !== "string") return { ok: false, error: `Field "${field.label}" must be text.` };
    const trimmed = value.trim();
    if (!trimmed) {
      if (field.required) return { ok: false, error: `Field "${field.label}" is required.` };
      continue;
    }
    if (value.length > (field.type === "textarea" ? 20000 : 2000)) return { ok: false, error: `Field "${field.label}" is too long.` };
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false, error: `Field "${field.label}" must be an email address.` };
    if (field.type === "select" && !field.options?.includes(value)) return { ok: false, error: `Field "${field.label}" must use an available option.` };
    if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
      Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ||
      new Date(`${trimmed}T00:00:00Z`).toISOString().slice(0, 10) !== trimmed)) {
      return { ok: false, error: `Field "${field.label}" must be a valid date.` };
    }
    accepted[field.key] = field.type === "textarea" || field.type === "select" ? value : trimmed;
  }
  return { ok: true, values: accepted };
}