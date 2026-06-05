export function formatDate(value?: string | number | Date | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value?: string | number | Date | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatNumber(value?: number | string | null) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN").format(number);
}

export function formatMoney(value?: number | string | null) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(number);
}