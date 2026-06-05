import { EmailDiscovery } from "../models/EmailDiscovery.model";
import { Contact } from "../models/Contact.model";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_PATTERNS = [
  "example.com",
  "sentry",
  "webpack",
  "google.com",
  "youtube.com",
  "schema.org",
  "gstatic",
  "googleapis",
  "w3.org",
  "noreply",
  "no-reply",
  "wixpress",
  "cloudflare",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg"
];

function cleanEmail(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/^[<>"'()[\],;:\s]+/g, "")
    .replace(/[<>"'()[\],;:\s]+$/g, "");
}

function extractEmails(text: string) {
  const matches = String(text || "").match(EMAIL_REGEX) || [];

  const seen = new Set<string>();
  const emails: string[] = [];

  for (const email of matches) {
    const clean = cleanEmail(email);

    if (!clean) continue;
    if (clean.length < 6) continue;
    if (JUNK_PATTERNS.some((pattern) => clean.includes(pattern))) continue;
    if (seen.has(clean)) continue;

    seen.add(clean);
    emails.push(clean);
  }

  return emails;
}

export async function updateTotalEmailsForBrand(brandName: string, domain: string) {
  const row = await EmailDiscovery.findOne({
    brandName,
    domain
  });

  if (!row) {
    return {
      total: 0
    };
  }

  const allText = [
    row.instagram,
    row.twitter,
    row.facebook,
    row.linkedin,
    row.youtube,
    row.website,
    row.hunter,
    row.apollo,
    row.prospeo
  ].join("\n");

  const emails = extractEmails(allText);

  await EmailDiscovery.findByIdAndUpdate(row._id, {
    $set: {
      totalEmails: emails.length > 0 ? emails.join("\n") : "(No emails found)",
      status: "total_emails_updated"
    }
  });

  for (const email of emails) {
    await Contact.findOneAndUpdate(
      {
        brandMapId: row.brandMapId,
        email
      },
      {
        $set: {
          seedBrandId: row.seedBrandId,
          brandMapId: row.brandMapId,
          brandName,
          domain,
          fullName: "",
          firstName: "",
          lastName: "",
          email,
          designation: "",
          role: "",
          department: "",
          source: "email_discovery",
          confidence: 0,
          status: "email_found",
          verificationStatus: "not_verified",
          raw: {
            emailDiscoveryId: row._id
          }
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }

  return {
    total: emails.length
  };
}
