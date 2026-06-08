export function cleanText(value: any) {
  return String(value || "").trim();
}

export function getDomainFromEmail(email: any) {
  const text = cleanText(email).toLowerCase();
  const parts = text.split("@");

  if (parts.length !== 2) return "";

  return parts[1].trim();
}

export async function checkEmailGateway(domain: any) {
  const cleanDomain = cleanText(domain).toLowerCase();

  if (!cleanDomain) return "Safe";

  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=MX`
    );

    if (!response.ok) return "Safe";

    const data: any = await response.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];

    const mxText = answers
      .map((answer: any) => cleanText(answer?.data).toLowerCase())
      .join(" ");

    if (mxText.includes("mimecast")) return "Mimecast";
    if (mxText.includes("proofpoint")) return "Proofpoint";
    if (mxText.includes("barracuda")) return "Barracuda";
    if (mxText.includes("ironport") || mxText.includes("iphmx")) return "IronPort";
    if (mxText.includes("sophos")) return "Sophos";
    if (mxText.includes("fortimail")) return "FortiMail";
    if (mxText.includes("ppe-hosted") || mxText.includes("frontbridge")) {
      return "Microsoft ATP";
    }

    return "Safe";
  } catch {
    return "Safe";
  }
}
