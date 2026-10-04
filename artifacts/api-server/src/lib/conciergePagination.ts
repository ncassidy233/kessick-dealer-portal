export type ConciergeCursor = {
  at: Date;
  id: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeConciergeCursor(cursor: ConciergeCursor) {
  return Buffer.from(
    JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id }),
  ).toString("base64url");
}

export function decodeConciergeCursor(
  value: string | undefined,
): ConciergeCursor | null {
  if (!value || value.length > 300) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { at?: unknown; id?: unknown };
    const at =
      typeof decoded.at === "string" ? new Date(decoded.at) : new Date(NaN);
    if (
      Number.isNaN(at.valueOf()) ||
      typeof decoded.id !== "string" ||
      !uuidPattern.test(decoded.id)
    ) {
      return null;
    }
    return { at, id: decoded.id };
  } catch {
    return null;
  }
}

export function encodeMessageCursor(position: number) {
  return Buffer.from(JSON.stringify({ position })).toString("base64url");
}

export function decodeMessageCursor(
  value: string | undefined,
): number | null {
  if (!value || value.length > 100) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { position?: unknown };
    return typeof decoded.position === "number" &&
      Number.isSafeInteger(decoded.position) &&
      decoded.position > 0
      ? decoded.position
      : null;
  } catch {
    return null;
  }
}

export function isOlderThanCursor<T>(
  row: T,
  cursor: ConciergeCursor,
  timestamp: (row: T) => Date,
  id: (row: T) => string,
) {
  const rowTime = timestamp(row).valueOf();
  const cursorTime = cursor.at.valueOf();
  return rowTime < cursorTime || (rowTime === cursorTime && id(row) < cursor.id);
}

export function paginateNewestFirst<T>(
  rows: T[],
  limit: number,
  timestamp: (row: T) => Date,
  id: (row: T) => string,
  chronological = false,
) {
  const page = rows.slice(0, limit);
  return {
    items: chronological ? [...page].reverse() : page,
    nextCursor:
      rows.length > limit
        ? encodeConciergeCursor({
            at: timestamp(page[page.length - 1]!),
            id: id(page[page.length - 1]!),
          })
        : null,
  };
}

export function paginateMessageRows<T>(
  rows: T[],
  limit: number,
  position: (row: T) => number,
) {
  const page = rows.slice(0, limit);
  return {
    items: [...page].reverse(),
    nextCursor:
      rows.length > limit
        ? encodeMessageCursor(position(page[page.length - 1]!))
        : null,
  };
}