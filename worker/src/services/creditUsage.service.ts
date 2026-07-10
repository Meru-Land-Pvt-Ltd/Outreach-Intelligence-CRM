import { CreditUsage } from "../models/CreditUsage.model";
import { normalizeDomainValue } from "../utils/normalize";

const CreditUsageModel = CreditUsage as any;

// Best-effort credit logging. Never throws — tracking must not break
// discovery. Credits are "estimated" unless the caller has actual usage
// numbers from the provider response.
export async function logCreditUsage(input: {
  provider: string;
  action: string;
  brandName?: string;
  domain?: string;
  seedBrandId?: any;
  brandMapId?: any;
  jobId?: string;
  credits?: number;
  usageType?: "actual" | "estimated";
  emailsFound?: number;
  contactsSelected?: number;
  success?: boolean;
  error?: string;
  raw?: any;
}) {
  try {
    await CreditUsageModel.create({
      provider: String(input.provider || "").toLowerCase(),
      action: String(input.action || ""),
      brandName: String(input.brandName || ""),
      domain: String(input.domain || "").toLowerCase(),
      normalizedDomain: normalizeDomainValue(input.domain),
      seedBrandId: input.seedBrandId || null,
      brandMapId: input.brandMapId || null,
      jobId: String(input.jobId || ""),
      credits: Number.isFinite(Number(input.credits)) ? Number(input.credits) : 1,
      usageType: input.usageType === "actual" ? "actual" : "estimated",
      emailsFound: Number(input.emailsFound || 0),
      contactsSelected: Number(input.contactsSelected || 0),
      success: input.success !== false,
      error: String(input.error || ""),
      raw: input.raw || {}
    });
  } catch (error: any) {
    console.error("Credit usage log failed:", error?.message || error);
  }
}
