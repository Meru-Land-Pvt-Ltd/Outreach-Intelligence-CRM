import axios from "axios";
import { env } from "../config/env";
import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { callOpenAIText } from "./ai.service";

type ApolloContact = {
  id: string;
  fullName: string;
  title: string;
  hasEmail: boolean;
};

function cleanDomain(domain: string) {
  return String(domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function parseSelectedIndexes(text: string, max: number) {
  const indexes: number[] = [];

  for (const line of String(text || "").split("\n")) {
    const num = parseInt(line.trim(), 10);

    if (!Number.isNaN(num) && num >= 1 && num <= max) {
      indexes.push(num - 1);
    }

    if (indexes.length >= 5) break;
  }

  return indexes;
}

async function searchApolloPeople(domain: string) {
  const allContacts: ApolloContact[] = [];
  let pageNum = 1;
  const maxResults = 100;
  let totalFetched = 0;
  let totalAvailable = 0;

  while (totalFetched < maxResults) {
    const response = await axios.post(
      "https://api.apollo.io/api/v1/mixed_people/api_search",
      {
        q_organization_domains: domain,
        page: pageNum,
        per_page: 25
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": env.apolloApiKey
        },
        timeout: 30000
      }
    );

    const result = response.data;

    if (result.error || !result.people) {
      break;
    }

    const people = result.people || [];

    if (people.length === 0) {
      break;
    }

    totalAvailable = result.total_entries || 0;

    for (const person of people) {
      const firstName = person.first_name || "";
      const lastNameObf = person.last_name_obfuscated || "";
      const displayName = firstName + (lastNameObf ? " " + lastNameObf : "");

      allContacts.push({
        id: person.id || "",
        fullName: displayName.trim() || "Unknown",
        title: person.title || "",
        hasEmail: Boolean(person.has_email)
      });
    }

    totalFetched += people.length;

    if (totalFetched >= totalAvailable || totalFetched >= maxResults) {
      break;
    }

    pageNum += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return allContacts;
}

function buildApolloFilterPrompt(brandName: string, domain: string, contacts: ApolloContact[]) {
  let contactListText = "";

  for (let i = 0; i < contacts.length; i++) {
    contactListText += `${i + 1}. ${contacts[i].fullName} | ${contacts[i].title}\n`;
  }

  return (
    "You are an expert at influencer marketing outreach for a talent management agency called CollabGlam.\n\n" +
    "Below is a list of people who work at the brand \"" + brandName + "\" (" + domain + ").\n" +
    "Each line has: Number. Full Name | Job Title\n\n" +
    contactListText + "\n" +
    "Your task: Select the TOP 3 to 5 people most likely to APPROVE and CLOSE influencer marketing sponsorship deals for a YouTube channel.\n\n" +
    "ONLY pick people whose designation matches or is very close to these:\n" +
    "- Marketing Manager\n" +
    "- Brand Partnership Manager\n" +
    "- VP of Sales\n" +
    "- Sales Manager\n" +
    "- Marketing Head\n" +
    "- Influencer Manager\n" +
    "- Creator Manager\n" +
    "- Head of Marketing\n" +
    "- Director of Marketing\n" +
    "- Growth Manager\n" +
    "- Partnerships Manager\n" +
    "- Head of Growth\n\n" +
    "MUST AVOID these roles — they do NOT handle influencer deals:\n" +
    "- HR, Talent Management, Recruiting, People Operations\n" +
    "- Legal, Finance, Accounting\n" +
    "- Engineering, IT, DevOps, QA\n" +
    "- Operations, Supply Chain, Logistics\n" +
    "- Customer Support, Customer Success\n\n" +
    "You MUST return at least 2 people (if 2+ exist with matching roles). Maximum 5.\n" +
    "Return ONLY the original list numbers, one per line, ranked from best to worst.\n\n" +
    "Example response:\n3\n7\n1\n12\n5\n\n" +
    "No extra text. Just the numbers."
  );
}

async function bulkMatchApollo(selectedIds: { id: string }[]) {
  if (selectedIds.length === 0) return [];

  const response = await axios.post(
    "https://api.apollo.io/api/v1/people/bulk_match",
    {
      details: selectedIds
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": env.apolloApiKey
      },
      timeout: 60000
    }
  );

  return response.data?.matches || [];
}

export async function findApolloPOCsForBrand(brandName: string, inputDomain: string) {
  if (!env.apolloApiKey || env.apolloApiKey.includes("your_")) {
    console.log("Apollo skipped: APOLLO_API_KEY missing");
    return { saved: 0 };
  }

  const domain = cleanDomain(inputDomain);

  const existing = await EmailDiscovery.findOne({
    brandName,
    domain
  });

  if (existing?.apollo && String(existing.apollo).trim() !== "") {
    return { skipped: true, saved: 0 };
  }

  const allContacts = await searchApolloPeople(domain);

  if (allContacts.length < 1) {
    console.log(brandName + " → No Apollo contacts found");
    return { saved: 0 };
  }

  const prompt = buildApolloFilterPrompt(brandName, domain, allContacts);
  const aiResponse = await callOpenAIText(prompt);

  let selectedIndexes = parseSelectedIndexes(aiResponse, allContacts.length);

  if (selectedIndexes.length < 2) {
    for (let i = 0; i < Math.min(5, allContacts.length); i++) {
      if (!selectedIndexes.includes(i)) {
        selectedIndexes.push(i);
      }

      if (selectedIndexes.length >= 2) break;
    }
  }

  const selectedIds = selectedIndexes
    .map((index) => allContacts[index])
    .filter((contact) => contact?.id)
    .map((contact) => ({ id: contact.id }));

  const revealedPeople = await bulkMatchApollo(selectedIds);

  const pocNamesList = revealedPeople
    .map((person: any) => {
      const fullName =
        person.first_name && person.last_name
          ? person.first_name + " " + person.last_name
          : person.name || person.first_name || person.last_name || "Unknown";

      const email = person.email || "";

      if (!email) return "";

      return fullName + " (" + email + ")";
    })
    .filter(Boolean);

  if (pocNamesList.length > 0) {
    await EmailDiscovery.findOneAndUpdate(
      {
        brandName,
        domain
      },
      {
        $set: {
          apollo: pocNamesList.join("\n"),
          status: "apollo_done"
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }

  console.log(brandName + " → Apollo POCs saved:", pocNamesList.length);

  return {
    saved: pocNamesList.length
  };
}
