import axios from "axios";
import { env } from "../config/env";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function buildProspeoUrl(endpoint: string) {
  return env.prospeoBaseUrl.replace(/\/$/, "") + endpoint;
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
    "influencer marketing manager",
    "creator partnerships manager",
    "head of marketing",
    "director of marketing",
    "growth manager",
    "affiliate manager",
    "public relations manager",
    "pr manager"
  ];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichProspeoPerson(person: any, domain: string) {
  const personId =
    person.person_id ||
    person.id ||
    person?.person?.person_id ||
    person?.person?.id;

  const fullName =
    person.full_name ||
    person.name ||
    person?.person?.full_name ||
    person?.person?.name ||
    "";

  const firstName =
    person.first_name ||
    person?.person?.first_name ||
    "";

  const lastName =
    person.last_name ||
    person?.person?.last_name ||
    "";

  const data: Record<string, any> = {};

  if (personId) {
    data.person_id = personId;
  } else if (fullName) {
    data.full_name = fullName;
    data.company_website = domain;
  } else if (firstName && lastName) {
    data.first_name = firstName;
    data.last_name = lastName;
    data.company_website = domain;
  } else {
    return null;
  }

  try {
    await sleep(env.prospeoRequestDelayMs || 1500);

    const response = await axios.post(
      buildProspeoUrl(env.prospeoEnrichPersonEndpoint || "/enrich-person"),
      {
        only_verified_email: true,
        data
      },
      {
        headers: getProspeoHeaders(),
        timeout: 30000
      }
    );

    return response.data?.response || response.data?.data || response.data;
  } catch (error: any) {
    console.error(
      "Prospeo enrich failed:",
      error?.response?.data || error.message
    );

    return null;
  }
}

export async function searchProspeoContacts(domain: string) {
  if (!env.prospeoApiKey || env.prospeoApiKey.includes("your_")) {
    console.log("Prospeo skipped: PROSPEO_API_KEY missing");
    return [];
  }

  if (!domain) return [];

  try {
    await sleep(env.prospeoRequestDelayMs || 1500);

    const response = await axios.post(
      buildProspeoUrl(env.prospeoSearchPersonEndpoint || "/search-person"),
      {
        page: 1,
        filters: {
          company: {
            websites: {
              include: [domain]
            }
          },
          person: {
            job_titles: {
              include: getTargetTitles()
            }
          }
        }
      },
      {
        headers: getProspeoHeaders(),
        timeout: 30000
      }
    );

    const results = response.data?.results || [];

    const contacts = [];

    for (const result of results.slice(0, env.maxContactsPerBrand || 10)) {
      const person = result.person || result;
      const company = result.company || {};
      const enriched = await enrichProspeoPerson(person, domain);

      if (!enriched) continue;

      const enrichedPerson = enriched.person || enriched;
      const email =
        normalizeEmail(enriched.email) ||
        normalizeEmail(enrichedPerson.email) ||
        normalizeEmail(enrichedPerson.work_email);

      if (!email) continue;

      const firstName =
        enrichedPerson.first_name ||
        person.first_name ||
        "";

      const lastName =
        enrichedPerson.last_name ||
        person.last_name ||
        "";

      const fullName =
        enrichedPerson.full_name ||
        enrichedPerson.name ||
        person.full_name ||
        person.name ||
        [firstName, lastName].filter(Boolean).join(" ");

      contacts.push({
        fullName,
        firstName,
        lastName,
        email,
        designation:
          enrichedPerson.job_title ||
          enrichedPerson.title ||
          person.job_title ||
          person.title ||
          "",
        role:
          enrichedPerson.job_title ||
          enrichedPerson.title ||
          person.job_title ||
          person.title ||
          "",
        department: "",
        confidence: Number(enriched.email_status === "verified" ? 100 : 0),
        source: "prospeo" as const,
        raw: {
          searchResult: result,
          enriched,
          company
        }
      });
    }

    return contacts;
  } catch (error: any) {
    console.error(
      "Prospeo search failed:",
      error?.response?.data || error.message
    );

    return [];
  }
}
