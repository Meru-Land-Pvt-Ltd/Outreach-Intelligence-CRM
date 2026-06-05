import axios from "axios";
import { Contact } from "../models/Contact.model";

const ContactModel = Contact as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

async function verifyEmail(email: string) {
  const key = process.env.MILLION_VERIFIER_API_KEY || "";

  if (!key) {
    throw new Error("MILLION_VERIFIER_API_KEY missing in worker/.env");
  }

  const response = await axios.get(
    process.env.MILLION_VERIFIER_BASE_URL ||
      "https://api.millionverifier.com/api/v3",
    {
      params: {
        api: key,
        email,
        timeout: process.env.MILLION_VERIFIER_TIMEOUT || 20
      },
      timeout: 30000,
      validateStatus: () => true
    }
  );

  const data = response.data || {};
  const result = String(data.result || data.status || data.quality || "")
    .trim()
    .toLowerCase();

  if (["ok", "valid", "good", "deliverable"].includes(result)) {
    return {
      status: "verified",
      verificationStatus: "Ok",
      verifierResult: "Ok",
      raw: data
    };
  }

  if (result.includes("catch")) {
    return {
      status: "risky",
      verificationStatus: "Catch-all",
      verifierResult: "Catch-all",
      raw: data
    };
  }

  if (["invalid", "bad", "undeliverable"].includes(result)) {
    return {
      status: "invalid",
      verificationStatus: "Invalid",
      verifierResult: "Invalid",
      raw: data
    };
  }

  if (result.includes("disposable")) {
    return {
      status: "invalid",
      verificationStatus: "Disposable",
      verifierResult: "Disposable",
      raw: data
    };
  }

  return {
    status: "risky",
    verificationStatus: "Unknown",
    verifierResult: "Unknown",
    raw: data
  };
}

export async function verifyPendingContacts() {
  const limit = Number(process.env.MAX_VERIFICATION_PER_RUN || 500);

  const contacts = await ContactModel.find({
    email: { $exists: true, $nin: ["", null] },
    verificationStatus: {
      $in: ["", null, "not_verified", "verification_pending"]
    }
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let verified = 0;
  let risky = 0;
  let invalid = 0;
  let failed = 0;

  for (const contact of contacts as any[]) {
    const email = cleanEmail(contact.email);

    if (!email) continue;

    try {
      const result = await verifyEmail(email);

      await ContactModel.findByIdAndUpdate(contact._id, {
        $set: {
          status: result.status,
          verificationStatus: result.verificationStatus,
          verifierResult: result.verifierResult,
          verifierRaw: result.raw,
          verifiedAt: new Date()
        }
      });

      if (result.verificationStatus === "Ok") verified += 1;
      else if (result.status === "invalid") invalid += 1;
      else risky += 1;
    } catch (error: any) {
      failed += 1;

      await ContactModel.findByIdAndUpdate(contact._id, {
        $set: {
          status: "verification_error",
          verificationStatus: "verification_error",
          verifierResult: cleanText(error.message),
          verifiedAt: new Date()
        }
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    scanned: contacts.length,
    verified,
    risky,
    invalid,
    failed
  };
}

export async function verifyContactsForSeedBrand(seedBrandId: string) {
  const contacts = await ContactModel.find({
    seedBrandId,
    email: { $exists: true, $nin: ["", null] },
    verificationStatus: {
      $in: ["", null, "not_verified", "verification_pending"]
    }
  }).sort({ createdAt: 1 });

  let verified = 0;
  let risky = 0;
  let invalid = 0;
  let failed = 0;

  for (const contact of contacts as any[]) {
    const email = cleanEmail(contact.email);

    if (!email) continue;

    try {
      const result = await verifyEmail(email);

      await ContactModel.findByIdAndUpdate(
        contact._id,
        {
          $set: {
            status: result.status,
            verificationStatus: result.verificationStatus,
            verifierResult: result.verifierResult,
            verifierRaw: result.raw,
            verifiedAt: new Date()
          }
        },
        { new: true }
      );

      if (result.verificationStatus === "Ok") verified += 1;
      else if (result.status === "invalid") invalid += 1;
      else risky += 1;
    } catch (error: any) {
      failed += 1;

      await ContactModel.findByIdAndUpdate(
        contact._id,
        {
          $set: {
            status: "verification_error",
            verificationStatus: "verification_error",
            verifierResult: cleanText(error.message),
            verifiedAt: new Date()
          }
        },
        { new: true }
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    scanned: contacts.length,
    verified,
    risky,
    invalid,
    failed
  };
}
