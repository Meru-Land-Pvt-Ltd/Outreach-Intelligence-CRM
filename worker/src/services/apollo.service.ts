import axios from "axios";
import { env } from "../config/env";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function buildApolloUrl(endpoint: string) {
  return env.apolloBaseUrl.replace(/\/$/, "") + endpoint;
}

function getApolloHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": env.apolloApiKey
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

async function enrichApolloPerson(person: any) {
  const email = normalizeEmail(person.email);

  if (email && !email.includes("email_not_unlocked")) {
    return person;
  }

  const firstName = person.first_name || "";
  const lastName = person.last_name || "";
  const fullName = person.name || [firstName, lastName].filter(Boolean).join(" ");

  try {
    const response = await axios.post(
      buildApolloUrl(env.apolloPeopleEnrichEndpoint || "/people/match"),
      {},
      {
        params: {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          name: fullName || undefined,
          organization_name: person.organization?.name || undefined,
          domain: person.organization?.primary_domain || undefined
        },
        headers: getApolloHeaders(),
        timeout: 30000
      }
    );

    return response.data?.person || person;
  } catch (error: any) {
    console.error(
      "Apollo enrich failed:",
      error?.response?.data || error.message
    );

    return person;
  }
}

export async function searchApolloContacts(domain: string) {
  if (!env.apolloApiKey || env.apolloApiKey.includes("your_")) {
    console.log("Apollo skipped: APOLLO_API_KEY missing");
    return [];
  }

  if (!domain) return [];

  try {
    const response = await axios.post(
      buildApolloUrl(env.apolloPeopleSearchEndpoint || "/mixed_people/api_search"),
      {
        q_organization_domains_list: [domain],
        person_titles: getTargetTitles(),
        include_similar_titles: true,
        page: 1,
        per_page: env.apolloPerPage || 10
      },
      {
        headers: getApolloHeaders(),
        timeout: 30000
      }
    );

    const people = response.data?.people || response.data?.contacts || [];

    const enrichedPeople = [];

    for (const person of people.slice(0, env.maxContactsPerBrand || 20)) {
      const enriched = await enrichApolloPerson(person);
      enrichedPeople.push(enriched);
    }

    return enrichedPeople
      .map((person: any) => {
        const firstName = person.first_name || "";
        const lastName = person.last_name || "";
        const fullName =
          person.name ||
          [firstName, lastName].filter(Boolean).join(" ");

        return {
          fullName,
          firstName,
          lastName,
          email: normalizeEmail(person.email),
          designation: person.title || "",
          role: person.title || "",
          department: "",
          confidence: 0,
          source: "apollo" as const,
          raw: person
        };
      })
      .filter((item: any) => item.email && !item.email.includes("email_not_unlocked"));
  } catch (error: any) {
    console.error(
      "Apollo search failed:",
      error?.response?.data || error.message
    );

    return [];
  }
}
