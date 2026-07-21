// CSV parsing + header mapping for inbound-lead imports.

export type ParsedLead = {
  email: string;
  firstName: string;
  companyName: string;
  productName: string;
  website: string;
  niche: string;
};

export type ParseResult = {
  fileName: string;
  totalRows: number;
  leads: ParsedLead[];
  mapping: Array<{ field: string; header: string }>;
  unmappedHeaders: string[];
  missingEmailHeader: boolean;
  emptyEmailRows: number;
};

export const IMPORT_CHUNK_SIZE = 200;

// header aliases → lead field (all compared lowercased, spaces collapsed)
const HEADER_ALIASES: Record<string, string[]> = {
  email: [
    "email",
    "e-mail",
    "email address",
    "e-mail address",
    "mail",
    "work email",
    "contact email",
    "email id",
    "poc email",
  ],
  firstName: [
    "first name",
    "firstname",
    "first",
    "name",
    "full name",
    "contact name",
    "contact",
    "poc",
    "poc name",
    "point of contact",
    "contact person",
    "person",
    "spoc",
    "lead name",
  ],
  companyName: [
    "company",
    "company name",
    "brand",
    "brand name",
    "organization",
    "organisation",
    "account",
    "business",
    "business name",
  ],
  productName: ["product", "product name", "products"],
  website: ["website", "domain", "url", "company website", "site", "web"],
  niche: ["niche", "category", "industry", "vertical", "segment"],
};

// Headers that usually hold a full name: keep only the first word so the
// {{firstName}} template variable reads naturally ("Hi Jane" not
// "Hi Jane Smith").
const FULL_NAME_HEADERS = new Set([
  "name",
  "full name",
  "contact name",
  "contact",
  "poc",
  "poc name",
  "point of contact",
  "contact person",
  "person",
  "spoc",
  "lead name",
]);

export const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  firstName: "First Name",
  companyName: "Company",
  productName: "Product",
  website: "Website",
  niche: "Niche",
};

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Minimal RFC 4180 parser: quoted fields, escaped quotes, CR/LF/CRLF, BOM.
export function parseCsv(text: string): string[][] {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function buildParseResult(fileName: string, text: string): ParseResult {
  const grid = parseCsv(text);

  if (grid.length === 0) {
    return {
      fileName,
      totalRows: 0,
      leads: [],
      mapping: [],
      unmappedHeaders: [],
      missingEmailHeader: true,
      emptyEmailRows: 0,
    };
  }

  const headers = grid[0].map(normalizeHeader);
  const columnField: Array<string | null> = headers.map((header) => {
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(header)) return field;
    }
    return null;
  });

  const mapping: Array<{ field: string; header: string }> = [];
  const unmappedHeaders: string[] = [];
  const mappedFields = new Set<string>();

  columnField.forEach((field, index) => {
    const originalHeader = String(grid[0][index] || "").trim();

    // first matching column per field wins
    if (field && !mappedFields.has(field)) {
      mappedFields.add(field);
      mapping.push({ field, header: originalHeader });
    } else {
      if (originalHeader) unmappedHeaders.push(originalHeader);
      columnField[index] = null;
    }
  });

  const missingEmailHeader = !mappedFields.has("email");
  const leads: ParsedLead[] = [];
  let emptyEmailRows = 0;

  for (let r = 1; r < grid.length; r++) {
    const lead: ParsedLead = {
      email: "",
      firstName: "",
      companyName: "",
      productName: "",
      website: "",
      niche: "",
    };

    columnField.forEach((field, index) => {
      if (!field) return;

      let value = String(grid[r][index] ?? "").trim();

      if (field === "firstName" && value && FULL_NAME_HEADERS.has(headers[index])) {
        value = value.split(/\s+/)[0];
      }

      (lead as any)[field] = value;
    });

    if (!lead.email) {
      emptyEmailRows += 1;
      continue;
    }

    leads.push(lead);
  }

  return {
    fileName,
    totalRows: grid.length - 1,
    leads,
    mapping,
    unmappedHeaders,
    missingEmailHeader,
    emptyEmailRows,
  };
}

export function downloadSampleCsv() {
  const sample =
    "Email,POC,Company Name,Product Name,Website,Niche\n" +
    "jane@acme.com,Jane Smith,Acme Corp,Acme Smart Lamp,acme.com,Smart Home\n" +
    "mark@brightco.io,Mark Lee,BrightCo,,brightco.io,AI Software / AI Tools\n";
  const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "inbound-leads-sample.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
