export type BrandMapNichePromptInput = {
  brand: string;
  productName?: string;
  channelCategory?: string;
  description?: string;
  existingNiches?: string[];
};

function cleanText(value?: string, fallback = "N/A") {
  const text = String(value || "").trim();
  return text || fallback;
}

function limitText(value?: string, limit = 1000) {
  return cleanText(value, "").slice(0, limit);
}

export function buildBrandMapNichePrompt(input: BrandMapNichePromptInput) {
  const existingNiches =
    input.existingNiches && input.existingNiches.length > 0
      ? input.existingNiches.map((niche) => niche.trim()).filter(Boolean)
      : [];

  const existingNicheText =
    existingNiches.length > 0 ? existingNiches.join("\n") : "None";

  return (
    "You are categorizing YouTube tech review videos into product niches for each video title written.\n\n" +
    "Brand: " + cleanText(input.brand) + "\n" +
    "Product Name: " + cleanText(input.productName) + "\n" +
    "Channel Category: " + cleanText(input.channelCategory) + "\n" +
    "Description: " + limitText(input.description, 1000) + "\n\n" +
    "Existing Niches:\n" +
    existingNicheText +
    "\n\n" +
    "If the brand fits an existing niche, use the closest existing niche. " +
    "Only create a new niche if none of the existing niches match. " +
    "Return ONLY the niche name, no extra text."
  );
}