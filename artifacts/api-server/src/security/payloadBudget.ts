import type { RequestHandler } from "express";

export function payloadWithinBudget(value: unknown, maxDepth = 32, maxNodes = 20_000): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++nodes > maxNodes || item.depth > maxDepth) return false;
    if (item.value && typeof item.value === "object") {
      const children = Object.values(item.value);
      if (children.length + pending.length + nodes > maxNodes) return false;
      for (const child of children) pending.push({ value: child, depth: item.depth + 1 });
    }
  }
  return true;
}
// Bound parser/schema CPU and memory before any account/provider/database work.
export const payloadBudget: RequestHandler = (req, res, next) => {
  if (req.body !== undefined && !payloadWithinBudget(req.body)) {
    res.status(413).json({ error: "Request data is too complex. Reduce its size or nesting." });
    return;
  }
  next();
};
