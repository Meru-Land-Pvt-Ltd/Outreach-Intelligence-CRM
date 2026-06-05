export function buildDomainFinderPrompt(brand: string, productHint?: string) {
  let webPrompt = 'Search the web for the brand "' + brand + '"';

  if (productHint) {
    webPrompt += " (they make products like: " + productHint + ")";
  }

  webPrompt += ".\n\n" +
    "IMPORTANT: You MUST visit the brand's official website. Look for the ACTUAL parent company domain.\n\n" +
    "Some brands are products under a parent company. For example:\n" +
    "- Deebot is a product line by ECOVACS, so the domain is ecovacs.com (deebot.com is just a parked domain)\n" +
    "- Roomba is a product line by iRobot, so the domain is irobot.com\n" +
    "- If a brand has its own standalone website (like ecoflow.com, bluetti.com), use that.\n\n" +
    "Find and return ONLY the official website domain in clean format (e.g., 'ecoflow.com').\n" +
    "No https://, no www., no trailing /. NOT amazon.com or any marketplace.\n\n" +
    "RESPOND with ONLY the domain, nothing else. Example: ecoflow.com\n\n" +
    "If you truly cannot find the domain after searching, respond with: N/A";

  return webPrompt;
}