import axios from "axios";
import { env } from "../config/env";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizeDomain(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/\/$/, "");
}

function buildProspeoUrl(endpoint: string) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return env.prospeoBaseUrl.replace(/\/$/, "") + cleanEndpoint;
}

function getProspeoHeaders() {
  return {
    "Content-Type": "application/json",
    "X-KEY": env.prospeoApiKey
  };
}

function getTargetTitles() {
  return [
    "marketing manager",
    "brand manager",
    "partnerships manager",
    "partnership manager",
    "influencer marketing manager",
    "creator partnerships manager",
    "affiliate marketing manager",
    "affiliate manager",
    "public relations manager",
    "media relations manager",
    "social media manager",
    "sponsorship manager",
    "head of marketing",
    "director of marketing",
    "growth manager",
    "pr manager"
  ];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProspeoError(error: any) {
  const data = error?.response?.data || error?.data || error;

  if (data?.error_code || data?.filter_error || data?.message) {
    return {
      status: error?.response?.status,
      error_code: data.error_code,
      filter_error: data.filter_error,
      message: data.message
    };
  }

  return error?.message || data;
}

function getPersonId(person: any) {
  return (
    person?.person_id ||
    person?.id ||
    person?.person?.person_id ||
    person?.person?.id ||
    ""
  );
}

function getFullName(person: any) {
  const firstName = person?.first_name || person?.person?.first_name || "";
  const lastName = person?.last_name || person?.person?.last_name || "";

  return (
    person?.full_name ||
    person?.name ||
    person?.person?.full_name ||
    person?.person?.name ||
    [firstName, lastName].filter(Boolean).join(" ")
  );
}

function getFirstName(person: any) {
  return person?.first_name || person?.person?.first_name || "";
}

function getLastName(person: any) {
  return person?.last_name || person?.person?.last_name || "";
}

function getCurrentTitle(person: any) {
  return (
    person?.current_job_title ||
    person?.job_title ||
    person?.title ||
    person?.headline ||
    ""
  );
}

function extractProspeoEmail(value: any) {
  if (!value) return "";

  if (typeof value === "string") {
    const email = normalizeEmail(value);
    return isValidEmail(email) ? email : "";
  }

  const email = normalizeEmail(
    value.email || value.value || value.address || value.email_address
  );

  return isValidEmail(email) ? email : "";
}

function extractProspeoEmailStatus(value: any) {
  if (!value || typeof value !== "object") return "";
  return String(value.status || value.email_status || value.verification_status || "");
}

function getEmailFromEnrichment(enriched: any) {
  const person = enriched?.person || enriched;

  return (
    extractProspeoEmail(person?.email) ||
    extractProspeoEmail(enriched?.email) ||
    extractProspeoEmail(person?.work_email) ||
    extractProspeoEmail(enriched?.work_email)
  );
}

function getEmailStatusFromEnrichment(enriched: any) {
  const person = enriched?.person || enriched;

  return (
    extractProspeoEmailStatus(person?.email) ||
    extractProspeoEmailStatus(enriched?.email) ||
    String(person?.email_status || enriched?.email_status || "")
  );
}

async function postProspeo(endpoint: string, payload: Record<string, any>) {
  const response = await axios.post(buildProspeoUrl(endpoint), payload, {
    headers: getProspeoHeaders(),
    timeout: 45000,
    validateStatus: () => true
  });

  if (response.status >= 400 || response.data?.error) {
    const error: any = new Error(response.data?.error_code || "PROSPEO_API_ERROR");
    error.response = response;
    throw error;
  }

  return response.data;
}

async function enrichProspeoPerson(person: any, company: any, domain: string) {
  const personId = getPersonId(person);
  const fullName = getFullName(person);
  const firstName = getFirstName(person);
  const lastName = getLastName(person);
  const companyWebsite = normalizeDomain(
    company?.domain || company?.website || domain
  );
  const companyName = company?.name || company?.company_name || "";

  const data: Record<string, any> = {};

  if (personId) {
    data.person_id = personId;
  } else if (fullName && companyWebsite) {
    data.full_name = fullName;
    data.company_website = companyWebsite;
    if (companyName) data.company_name = companyName;
  } else if (firstName && lastName && companyWebsite) {
    data.first_name = firstName;
    data.last_name = lastName;
    data.company_website = companyWebsite;
    if (companyName) data.company_name = companyName;
  } else if (person?.linkedin_url) {
    data.linkedin_url = person.linkedin_url;
  } else {
    return null;
  }

  try {
    await sleep(env.prospeoRequestDelayMs || 1500);

    return await postProspeo(env.prospeoEnrichPersonEndpoint || "/enrich-person", {
      only_verified_email: Boolean(env.prospeoOnlyVerifiedEmail),
      enrich_mobile: false,
      data
    });
  } catch (error: any) {
    const errorCode = error?.response?.data?.error_code;

    if (errorCode !== "NO_MATCH") {
      console.error("Prospeo enrich failed:", formatProspeoError(error));
    }

    return null;
  }
}

function buildSearchPayload(
  domain: string,
  includeTitleFilter: boolean,
  page: number
) {
  const filters: Record<string, any> = {
    company: {
      websites: {
        include: [domain]
      }
    },
    max_person_per_company: Math.min(Number(env.maxContactsPerBrand || 20), 25)
  };
  if (env.prospeoOnlyVerifiedEmail) {
    filters.person_contact_details = {
      email: ["VERIFIED"],
      operator: "OR",
      hide_people_with_details_already_revealed: false
    };
  }

  if (includeTitleFilter) {
    filters.person_job_title = {
      include: getTargetTitles(),
      match_mode: "CONTAINS"
    };
  }

  return {
    page,
    filters
  };
}

async function searchProspeoPage(
  domain: string,
  includeTitleFilter: boolean,
  page: number
) {
  try {
    await sleep(env.prospeoRequestDelayMs || 1500);

    const data = await postProspeo(
      env.prospeoSearchPersonEndpoint || "/search-person",
      buildSearchPayload(domain, includeTitleFilter, page)
    );

    return data?.results || [];
  } catch (error: any) {
    const errorCode = error?.response?.data?.error_code;

    if (errorCode === "NO_RESULTS") {
      return [];
    }

    console.error("Prospeo search failed:", formatProspeoError(error));
    return [];
  }
}

async function searchProspeoPages(domain: string, includeTitleFilter: boolean) {
  const pageLimit = Math.max(1, Math.min(Number(env.prospeoSearchPages || 3), 10));
  const collected: any[] = [];

  for (let page = 1; page <= pageLimit; page += 1) {
    const results = await searchProspeoPage(domain, includeTitleFilter, page);

    if (results.length === 0) break;

    collected.push(...results);

    // Prospeo search pages are fixed-size. If fewer than 25 came back,
    // there is normally no next page to fetch.
    if (results.length < 25) break;
  }

  return collected;
}

function uniqueProspeoResults(results: any[]) {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const result of results) {
    const person = result.person || result;
    const key =
      getPersonId(person) ||
      [
        getFullName(person).toLowerCase(),
        getCurrentTitle(person).toLowerCase(),
        person?.linkedin_url || ""
      ]
        .filter(Boolean)
        .join("|");

    if (!key || seen.has(key)) continue;

    seen.add(key);
    unique.push(result);
  }

  return unique;
}

export async function searchProspeoContacts(domain: string) {
  if (!env.prospeoApiKey || env.prospeoApiKey.includes("your_")) {
    console.log("Prospeo skipped: PROSPEO_API_KEY missing");
    return [];
  }

  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) return [];

  const targetedResults = await searchProspeoPages(normalizedDomain, true);
  const broadResults = await searchProspeoPages(normalizedDomain, false);
  const results = uniqueProspeoResults([...targetedResults, ...broadResults]);

  const contacts = [];
  const maxContacts = Math.max(1, Number(env.maxContactsPerBrand || 20));

  for (const result of results.slice(0, maxContacts)) {
    const person = result.person || result;
    const company = result.company || {};
    const enriched = await enrichProspeoPerson(person, company, normalizedDomain);

    if (!enriched) continue;

    const enrichedPerson = enriched.person || enriched;
    const enrichedCompany = enriched.company || company;
    const email = getEmailFromEnrichment(enriched);

    if (!email) continue;

    const firstName = enrichedPerson.first_name || person.first_name || "";
    const lastName = enrichedPerson.last_name || person.last_name || "";
    const fullName =
      enrichedPerson.full_name ||
      enrichedPerson.name ||
      person.full_name ||
      person.name ||
      [firstName, lastName].filter(Boolean).join(" ");
    const designation =
      enrichedPerson.current_job_title ||
      getCurrentTitle(enrichedPerson) ||
      getCurrentTitle(person);
    const emailStatus =
      getEmailStatusFromEnrichment(enriched) ||
      getEmailStatusFromEnrichment(result) ||
      "Found";

    contacts.push({
      fullName,
      firstName,
      lastName,
      email,
      designation,
      role: designation,
      department: Array.isArray(enrichedPerson?.job_history?.[0]?.departments)
        ? enrichedPerson.job_history[0].departments.join(", ")
        : "",
      country:
        enrichedPerson?.location?.country ||
        enrichedCompany?.location?.country ||
        "",
      emailStatus,
      confidence: emailStatus.toUpperCase() === "VERIFIED" ? 100 : 80,
      source: "prospeo" as const,
      raw: {
        searchResult: result,
        enriched,
        company: enrichedCompany
      }
    });
  }

  const seen = new Set<string>();
  return contacts.filter((contact) => {
    if (seen.has(contact.email)) return false;
    seen.add(contact.email);
    return true;
  });
}
