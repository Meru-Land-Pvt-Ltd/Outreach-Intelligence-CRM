// Ranks contacts for outreach and enforces the per-brand cap.
// Keep backend/src/utils/contactRanking.ts identical. Pure functions only.

export type RankableContact = {
  email?: string;
  fullName?: string;
  designation?: string;
  role?: string;
  verificationStatus?: string;
  status?: string;
  source?: string;
};

const AVOID_EMAIL_LOCAL_WORDS = [
  "noreply",
  "no-reply",
  "donotreply",
  "careers",
  "career",
  "jobs",
  "job",
  "recruit",
  "recruiting",
  "recruitment",
  "talent",
  "hr",
  "humanresources",
  "legal",
  "counsel",
  "compliance",
  "billing",
  "payroll",
  "finance",
  "accounting",
  "accounts",
  "invoice",
  "privacy",
  "abuse",
  "webmaster",
  "postmaster",
  "unsubscribe",
  "newsletter"
];

const STRONG_TITLE_KEYWORDS = [
  "influencer",
  "creator",
  "partnership",
  "sponsorship",
  "collab",
  "affiliate"
];

const RELEVANT_TITLE_KEYWORDS = [
  "marketing",
  "brand",
  "public relations",
  "communication",
  "comms",
  "growth",
  "business development",
  "media",
  "social",
  "sales",
  "product",
  "operations"
];

const SENIOR_TITLE_KEYWORDS = [
  "head",
  "director",
  "vp",
  "vice president",
  "chief",
  "cmo",
  "ceo",
  "founder",
  "co-founder",
  "cofounder",
  "owner",
  "president",
  "lead"
];

const AVOID_TITLE_KEYWORDS = [
  "human resources",
  "recruiter",
  "recruiting",
  "talent acquisition",
  "legal",
  "counsel",
  "paralegal",
  "attorney",
  "accountant",
  "accounting",
  "finance",
  "financial",
  "controller",
  "payroll",
  "bookkeep",
  "software engineer",
  "backend engineer",
  "frontend engineer",
  "fullstack engineer",
  "developer",
  "devops",
  "sre",
  "qa engineer",
  "data engineer",
  "support engineer",
  "customer support",
  "customer service",
  "warehouse",
  "driver"
];

const GENERIC_LOCAL_WORDS = [
  "hello",
  "support",
  "sales",
  "marketing",
  "contact",
  "info",
  "service",
  "media",
  "affiliate",
  "kol",
  "influencer",
  "press",
  "pr",
  "team",
  "admin",
  "care",
  "help",
  "partners",
  "partnership",
  "partnerships",
  "business"
];

function localPartMatchesWord(local: string, word: string) {
  if (local === word) return true;

  for (const sep of [".", "-", "_", "+"]) {
    if (local.startsWith(word + sep)) return true;
    if (local.endsWith(sep + word)) return true;
    if (local.includes(sep + word + sep)) return true;
  }

  return false;
}

export function isAvoidedOutreachEmail(email: any) {
  const local = String(email || "").split("@")[0].toLowerCase();

  if (!local) return true;

  return AVOID_EMAIL_LOCAL_WORDS.some((word) => localPartMatchesWord(local, word));
}

function isGenericLocalPart(email: string) {
  const local = String(email || "").split("@")[0].toLowerCase();

  return GENERIC_LOCAL_WORDS.some((word) => localPartMatchesWord(local, word));
}

function titleIncludes(title: string, keywords: string[]) {
  const lower = String(title || "").toLowerCase();

  if (!lower.trim()) return false;

  return keywords.some((keyword) => lower.includes(keyword));
}

function isVerifiedStatus(value: any) {
  const lower = String(value || "").toLowerCase().replace(/[\s_-]+/g, "-");

  return ["ok", "valid", "verified", "deliverable", "good"].includes(lower);
}

function isRejectedStatus(value: any) {
  const lower = String(value || "").toLowerCase().replace(/[\s_-]+/g, "-");

  return [
    "invalid",
    "bad",
    "undeliverable",
    "bounced",
    "disposable",
    "rejected",
    "failed",
    "skipped"
  ].includes(lower);
}

// Returns a score, or null when the contact must not be used for outreach.
export function scoreContactForOutreach(contact: RankableContact): number | null {
  const email = String(contact.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) return null;
  if (isAvoidedOutreachEmail(email)) return null;
  if (isRejectedStatus(contact.verificationStatus) || isRejectedStatus(contact.status)) {
    return null;
  }

  const title = String(contact.designation || contact.role || "");

  if (titleIncludes(title, AVOID_TITLE_KEYWORDS) && !titleIncludes(title, RELEVANT_TITLE_KEYWORDS) && !titleIncludes(title, STRONG_TITLE_KEYWORDS)) {
    return null;
  }

  let score = 0;

  if (isVerifiedStatus(contact.verificationStatus) || contact.status === "verified") {
    score += 40;
  }

  if (titleIncludes(title, STRONG_TITLE_KEYWORDS) || /\bpr\b/i.test(title)) {
    score += 30;
  } else if (titleIncludes(title, RELEVANT_TITLE_KEYWORDS)) {
    score += 20;
  }

  if (titleIncludes(title, SENIOR_TITLE_KEYWORDS)) {
    score += 10;
  }

  if (!isGenericLocalPart(email)) {
    score += 15;
  }

  return score;
}

// Filters unusable contacts, ranks the rest best-first, dedupes by email and
// returns at most `limit` contacts.
export function selectBestContactsForOutreach<T extends RankableContact>(
  contacts: T[],
  limit: number
): T[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 4;

  const scored = contacts
    .map((contact) => ({ contact, score: scoreContactForOutreach(contact) }))
    .filter((entry): entry is { contact: T; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score);

  const seenEmails = new Set<string>();
  const selected: T[] = [];

  for (const entry of scored) {
    const email = String(entry.contact.email || "").trim().toLowerCase();

    if (seenEmails.has(email)) continue;

    seenEmails.add(email);
    selected.push(entry.contact);

    if (selected.length >= safeLimit) break;
  }

  return selected;
}

export function getMaxEmailsPerBrand() {
  const value = Number(process.env.MAX_EMAILS_PER_BRAND || 4);

  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 10) : 4;
}
