export const COMPETITOR_FINDER_SYSTEM_PROMPT =
  "You are a market research assistant. Always respond with valid JSON only.";

export function buildCompetitorFinderPrompt(brands: string[]) {
  const prompt =
    "For each brand below, give me their top 2 direct competitors in the same product category. " +
    "These should be brands that sell similar products and compete for the same customers.\n\n" +
    "Brands:\n" +
    brands.map(function (b, idx) {
      return idx + 1 + ". " + b;
    }).join("\n") +
    "\n\n" +
    "Reply ONLY in this exact JSON format, no other text:\n" +
    '{"results": [{"brand": "BrandName", "competitor1": "Competitor1", "competitor2": "Competitor2"}]}';

  return prompt;
}