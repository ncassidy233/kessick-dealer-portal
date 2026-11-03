/** Detailed exceptions can contain response bodies and customer data. */
export function reportClientError(message: string, ...details: unknown[]) {
  if (import.meta.env.DEV) console.error(message, ...details);
  else console.error(message);
}
