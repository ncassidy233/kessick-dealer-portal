export type CsvCell = string | number | undefined | null;

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);

  const safeValue = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (
    safeValue.includes(",") ||
    safeValue.includes('"') ||
    safeValue.includes("\n") ||
    safeValue.includes("\r")
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function toCsvString(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}