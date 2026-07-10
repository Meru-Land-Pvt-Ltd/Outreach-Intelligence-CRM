// Minimal CSV helpers for the conversion-sheet export. Pure functions.

export function escapeCsvCell(value: any): string {
  const text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

export function buildCsv(headers: string[], rows: Array<Record<string, any>>): string {
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}
