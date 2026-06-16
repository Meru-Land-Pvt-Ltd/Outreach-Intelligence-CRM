import axios from "axios";
import dns from "dns/promises";
import { InstantlyLead } from "../models/InstantlyLead.model";
import { env } from "../config/env";

const InstantlyLeadModel = InstantlyLead as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function getDomainFromEmail(email: string) {
  return cleanEmail(email).split("@")[1]?.trim().toLowerCase() || "";
}

function needsVerification(value: any) {
  const status = cleanText(value).toLowerCase().replace(/[\s_]+/g, "-");

  return (
    !status ||
    status === "-" ||
    status === "not-verified" ||
    status === "not-checked" ||
    status === "pending" ||
    status === "pending-verification" ||
    status === "verification-pending"
  );
}

function needsGatewayCheck(value: any) {
  const status = cleanText(value).toLowerCase().replace(/[\s_]+/g, "-");

  return !status || status === "-" || status === "not-checked" || status === "pending";
}

async function verifyEmailWithMillionVerifier(email: string) {
  if (!env.millionVerifierApiKey) {
    return {
      status: "Pending Verification",
      raw: { skipped: true, reason: "MILLION_VERIFIER_API_KEY missing in worker/.env" }
    };
  }

  const response = await axios.get(env.millionVerifierBaseUrl, {
    params: {
      api: env.millionVerifierApiKey,
      email,
      timeout: env.millionVerifierTimeout
    },
    timeout: 30000,
    validateStatus: () => true
  });

  const data = response.data || {};
  const result = String(data.result || data.status || data.quality || "")
    .trim()
    .toLowerCase();

  if (response.status < 200 || response.status >= 300) {
    return {
      status: "Verification Error",
      raw: data
    };
  }

  if (["ok", "valid", "good", "deliverable"].includes(result)) {
    return {
      status: "Ok",
      raw: data
    };
  }

  if (result.includes("catch")) {
    return {
      status: "Catch-all",
      raw: data
    };
  }

  if (["invalid", "bad", "undeliverable"].includes(result)) {
    return {
      status: "Invalid",
      raw: data
    };
  }

  if (result.includes("disposable")) {
    return {
      status: "Disposable",
      raw: data
    };
  }

  return {
    status: "Unknown",
    raw: data
  };
}

async function checkEmailGateway(domain: string) {
  if (!domain) return "No Domain";

  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0 ? "Safe" : "No MX";
  } catch {
    return "No MX";
  }
}

export async function backfillInstantlyLeadVerificationAndGateway(companyNames?: string[]) {
  const baseFilter: Record<string, any> = {
    email: { $exists: true, $nin: ["", null] },
    $or: [
      { verificationStatus: { $exists: false } },
      { verificationStatus: "" },
      { verificationStatus: null },
      { verificationStatus: "-" },
      { verificationStatus: /^not[\s_-]?verified$/i },
      { verificationStatus: /^pending/i },
      { verificationStatus: /^verification[\s_-]?pending$/i },
      { gatewayBounced: { $exists: false } },
      { gatewayBounced: "" },
      { gatewayBounced: null },
      { gatewayBounced: "-" },
      { gatewayBounced: /^not[\s_-]?checked$/i },
      { gatewayBounced: /^pending$/i }
    ]
  };

  if (companyNames && companyNames.length > 0) {
    baseFilter.companyName = { $in: companyNames.map(cleanText).filter(Boolean) };
  }

  const limit = Math.max(Number(process.env.MAX_INSTANTLY_LEAD_HYGIENE_PER_RUN || 100000), 1);
  const rows = await InstantlyLeadModel.find(baseFilter)
    .sort({ createdAt: 1 })
    .limit(limit);

  let verificationUpdated = 0;
  let gatewayUpdated = 0;
  let skipped = 0;
  let failed = 0;
  const checkedGateways: Record<string, string> = {};

  console.log("Instantly lead hygiene started:", rows.length, "rows");

  for (const row of rows as any[]) {
    const email = cleanEmail(row.email);

    if (!email) {
      skipped += 1;
      continue;
    }

    const update: Record<string, any> = {};
    const raw = {
      ...(row.raw || {})
    };

    try {
      if (needsVerification(row.verificationStatus)) {
        const verified = await verifyEmailWithMillionVerifier(email);
        update.verificationStatus = verified.status;
        raw.millionVerifier = verified.raw;
        verificationUpdated += 1;

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (needsGatewayCheck(row.gatewayBounced)) {
        const domain = getDomainFromEmail(email);
        let gatewayStatus = checkedGateways[domain];

        if (!gatewayStatus) {
          gatewayStatus = await checkEmailGateway(domain);
          if (domain) checkedGateways[domain] = gatewayStatus;
        }

        update.gatewayBounced = gatewayStatus;
        gatewayUpdated += 1;
      }

      if (Object.keys(update).length > 0) {
        update.raw = raw;
        await InstantlyLeadModel.findByIdAndUpdate(row._id, {
          $set: update
        });
      }
    } catch (error: any) {
      failed += 1;
      await InstantlyLeadModel.findByIdAndUpdate(row._id, {
        $set: {
          verificationStatus: cleanText(row.verificationStatus) || "Verification Error",
          gatewayBounced: cleanText(row.gatewayBounced) || "Not Checked",
          raw: {
            ...(row.raw || {}),
            instantlyLeadHygieneError: error?.message || String(error)
          }
        }
      });
    }
  }

  const stillMissing = await InstantlyLeadModel.countDocuments({
    email: { $exists: true, $nin: ["", null] },
    $or: [
      { verificationStatus: { $exists: false } },
      { verificationStatus: "" },
      { verificationStatus: null },
      { verificationStatus: "-" },
      { gatewayBounced: { $exists: false } },
      { gatewayBounced: "" },
      { gatewayBounced: null },
      { gatewayBounced: "-" }
    ]
  });

  return {
    scanned: rows.length,
    verificationUpdated,
    gatewayUpdated,
    skipped,
    failed,
    stillMissing
  };
}
