import { AppSettings } from "./appSettings.service";
import { ROLE_TIER_PATTERNS } from "./instantlyExport.service";

// Combined provider-contact selection: one place decides which of the
// contacts found by Hunter/Apollo/Prospeo are actually kept (and saved as
// Contacts), enforcing the combined providerEmailCap and the role targeting
// configured in Pipeline Settings.

export type ProviderContact = {
  email: string;
  fullName: string;
  role: string;
  source: "hunter" | "apollo" | "prospeo";
  raw: any;
};

const SOURCE_PRIORITY: Record<string, number> = {
  apollo: 0,
  prospeo: 1,
  hunter: 2
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toMatchers(keywords: string[]) {
  return (keywords || [])
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .map((keyword) => new RegExp(escapeRegex(keyword), "i"));
}

export function buildRoleMatchers(settings: AppSettings) {
  return {
    target: toMatchers(settings.targetRoleKeywords),
    exclude: toMatchers(settings.excludeRoleKeywords),
    seniority: toMatchers(settings.targetSeniorityKeywords)
  };
}

export function isExcludedRole(role: string, settings: AppSettings) {
  const matchers = buildRoleMatchers(settings);
  return matchers.exclude.some((rx) => rx.test(String(role || "")));
}

// Rank: (1) target role + seniority, (2) target role, (3) known-good tier
// from the export ROLE_TIER_PATTERNS, (4) everything else. Exclude-matches
// are dropped entirely. Tie-breaks: source (apollo > prospeo > hunter,
// because Apollo emails are revealed/verified) then original order.
export function selectProviderContacts(
  pool: ProviderContact[],
  cap: number,
  settings: AppSettings
) {
  const byEmail = new Map<string, ProviderContact>();

  for (const contact of pool) {
    const email = String(contact.email || "").trim().toLowerCase();

    if (!email) continue;

    const existing = byEmail.get(email);

    if (!existing || (!existing.role && contact.role)) {
      byEmail.set(email, { ...contact, email });
    }
  }

  const matchers = buildRoleMatchers(settings);

  const scored = Array.from(byEmail.values())
    .map((contact, index) => {
      const role = String(contact.role || "");
      const excluded = matchers.exclude.some((rx) => rx.test(role));
      const targetMatch = matchers.target.some((rx) => rx.test(role));
      const seniorityMatch = matchers.seniority.some((rx) => rx.test(role));

      let rank = 4;

      if (targetMatch && seniorityMatch) {
        rank = 1;
      } else if (targetMatch) {
        rank = 2;
      } else {
        for (const { tier, pattern } of ROLE_TIER_PATTERNS) {
          if (tier <= 3 && pattern.test(role)) {
            rank = 3;
            break;
          }
        }
      }

      return {
        contact,
        excluded,
        rank,
        sourceRank: SOURCE_PRIORITY[contact.source] ?? 3,
        index
      };
    })
    .filter((item) => !item.excluded);

  scored.sort(
    (a, b) =>
      a.rank - b.rank || a.sourceRank - b.sourceRank || a.index - b.index
  );

  return scored.slice(0, Math.max(1, cap)).map((item) => item.contact);
}

// Apollo POC selection prompt: strict targeting with a seniority floor and
// an explicit avoid-list, both injected from settings.
export function buildApolloPocSelectionPrompt(
  brandName: string,
  people: any[],
  settings: AppSettings
) {
  return [
    "You are selecting outreach contacts for a US-market tech brand. From the people below, select the top 2 to 5 who most likely OWN influencer sponsorships, creator partnerships, affiliate programs, product/brand marketing campaigns, or PR/media relations for \"" +
      brandName +
      "\".",
    "",
    "TARGET roles (any of): " + settings.targetRoleKeywords.join(", ") + ".",
    "PREFER decision makers: " +
      settings.targetSeniorityKeywords.join(", ") +
      " level.",
    "MUST AVOID: " +
      settings.excludeRoleKeywords.join(", ") +
      ", and any other role that clearly cannot buy influencer marketing.",
    "",
    "People:",
    JSON.stringify(
      people.map((p: any) => ({
        id: p.id,
        name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" "),
        title: p.title
      })),
      null,
      2
    ),
    "",
    'Return JSON only: {"ids":["apollo_id_1"]}. If no one fits, return {"ids":[]}.'
  ].join("\n");
}
