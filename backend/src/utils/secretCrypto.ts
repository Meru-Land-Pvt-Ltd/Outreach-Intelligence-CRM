import crypto from "crypto";

// AES-256-GCM encryption for secrets stored in MongoDB (AI provider API keys).
// Set SETTINGS_ENCRYPTION_KEY in the environment for real protection; without
// it a built-in fallback secret is used, which only obfuscates against casual
// database reads. Keep worker/src/utils/secretCrypto.ts identical.

const FALLBACK_SECRET = "outreach-crm-ai-settings-v1";
const STATIC_SALT = "outreach-crm-secret-salt";

function getKey() {
  return crypto.scryptSync(
    process.env.SETTINGS_ENCRYPTION_KEY || FALLBACK_SECRET,
    STATIC_SALT,
    32
  );
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64")
  ].join(".");
}

export function decryptSecret(value: string): string {
  try {
    const [version, ivPart, tagPart, dataPart] = String(value || "").split(".");

    if (version !== "v1" || !ivPart || !tagPart || !dataPart) return "";

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivPart, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
}
