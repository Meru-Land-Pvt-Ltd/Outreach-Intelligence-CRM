import axios from "axios";
import { env } from "../config/env";

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

export async function searchHunterContacts(domain: string) {
  if (!env.hunterApiKey) {
    console.log("Hunter skipped: HUNTER_API_KEY missing");
    return [];
  }

  if (!domain) return [];

  try {
    const response = await axios.get(
      env.hunterBaseUrl + env.hunterDomainSearchEndpoint,
      {
        params: {
          domain,
          api_key: env.hunterApiKey,
          limit: env.hunterLimit || 10
        },
        timeout: 30000
      }
    );

    const emails = response.data?.data?.emails || [];

    return emails
      .map((item: any) => {
        const firstName = item.first_name || "";
        const lastName = item.last_name || "";
        const fullName =
          item.full_name ||
          [firstName, lastName].filter(Boolean).join(" ");

        return {
          fullName,
          firstName,
          lastName,
          email: normalizeEmail(item.value),
          designation: item.position || "",
          role: item.position || "",
          department: item.department || "",
          confidence: Number(item.confidence || 0),
          source: "hunter",
          raw: item
        };
      })
      .filter((item: any) => item.email);
  } catch (error: any) {
    console.error(
      "Hunter search failed:",
      error?.response?.data || error.message
    );

    return [];
  }
}
