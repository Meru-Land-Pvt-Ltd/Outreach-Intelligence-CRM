const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;

const mongoose = require("../node_modules/mongoose");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[_\s]+/g, "-");
}

function getEmailDomain(email) {
  const text = clean(email).toLowerCase();
  const parts = text.split("@");

  if (parts.length !== 2) return "";

  return parts[1].trim();
}

function isVerificationOk(value) {
  const status = normalize(value);

  return status === "ok" || status === "valid" || status === "deliverable";
}

function isVerificationMissing(value) {
  const status = normalize(value);

  return !status || status === "-";
}

function detectGatewayFromMx(mxHosts) {
  const mx = mxHosts.join(" ").toLowerCase();

  if (mx.includes("mimecast")) return "Mimecast";

  if (
    mx.includes("proofpoint") ||
    mx.includes("pphosted") ||
    mx.includes("ppe-hosted")
  ) {
    return "Proofpoint";
  }

  if (mx.includes("barracuda")) return "Barracuda";

  if (
    mx.includes("ironport") ||
    mx.includes("iphmx") ||
    mx.includes("cisco")
  ) {
    return "IronPort";
  }

  if (mx.includes("sophos")) return "Sophos";

  if (
    mx.includes("fortimail") ||
    mx.includes("fortinet")
  ) {
    return "FortiMail";
  }

  if (
    mx.includes("protection.outlook.com") ||
    mx.includes("frontbridge") ||
    mx.includes("messaging.microsoft.com") ||
    mx.includes("mail.protection.outlook.com")
  ) {
    return "Microsoft ATP";
  }

  return "Safe";
}

async function checkEmailGateway(domain) {
  const cleanDomain = clean(domain).toLowerCase();

  if (!cleanDomain) return "Safe";

  try {
    const records = await dns.resolveMx(cleanDomain);
    const mxHosts = records
      .map((record) => clean(record.exchange))
      .filter(Boolean);

    if (mxHosts.length === 0) return "Safe";

    return detectGatewayFromMx(mxHosts);
  } catch {
    return "Safe";
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, "../..");

  loadEnv(path.join(projectRoot, "backend/.env.production"));
  loadEnv(path.join(projectRoot, "backend/.env"));

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI missing from backend env.");
  }

  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  await mongoose.connect(process.env.MONGODB_URI);

  const db = mongoose.connection.db;
  const leads = db.collection("instantlyleads");

  const filter = force
    ? {}
    : {
        $or: [
          { gatewayBounced: { $exists: false } },
          { gatewayBounced: "" },
          { gatewayBounced: null },
          { gatewayBounced: "-" },
          { gatewayBounced: "Not Checked" }
        ]
      };

  const before = await leads.aggregate([
    { $group: { _id: "$gatewayBounced", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log("Before gatewayBounced counts:");
  console.log(before);

  const rows = await leads.find(filter).project({
    email: 1,
    verificationStatus: 1,
    gatewayBounced: 1
  }).toArray();

  console.log("Rows selected:", rows.length);
  console.log("Mode:", dryRun ? "DRY RUN" : "UPDATE");
  console.log("Force:", force);

  const gatewayCache = new Map();
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const verificationStatus = clean(row.verificationStatus);
    let gatewayBounced = "";

    if (isVerificationMissing(verificationStatus)) {
      gatewayBounced = "Not Checked";
    } else if (!isVerificationOk(verificationStatus)) {
      gatewayBounced = "Verification Failed";
    } else {
      const domain = getEmailDomain(row.email);

      if (gatewayCache.has(domain)) {
        gatewayBounced = gatewayCache.get(domain);
      } else {
        gatewayBounced = await checkEmailGateway(domain);
        gatewayCache.set(domain, gatewayBounced);
      }
    }

    if (clean(row.gatewayBounced) === gatewayBounced) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await leads.updateOne(
        { _id: row._id },
        {
          $set: {
            gatewayBounced,
            gatewayBouncedCheckedAt: new Date(),
            gatewayBouncedSource: "mx-dns-backfill"
          }
        }
      );
    }

    updated += 1;

    if (updated % 50 === 0) {
      console.log("Updated:", updated);
    }
  }

  console.log("Updated:", updated);
  console.log("Skipped unchanged:", skipped);
  console.log("Unique domains checked:", gatewayCache.size);

  const after = await leads.aggregate([
    { $group: { _id: "$gatewayBounced", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log("After gatewayBounced counts:");
  console.log(after);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
