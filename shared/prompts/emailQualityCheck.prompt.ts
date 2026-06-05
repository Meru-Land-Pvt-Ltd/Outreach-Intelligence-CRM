export function buildSocialUrlFinderSystemPrompt(
  brandName: string,
  domain: string,
  missing: string[]
) {
  return (
    "Find the official social media profiles for the brand '" + brandName + "' (" + domain + "). " +
    "I need ONLY these platforms: " + missing.join(", ") + ". " +
    "Search the web and find the correct official profile URLs. Do NOT guess. " +
    "For YouTube, find ALL channels (including regional ones with the brand name). " +
    "Return ONLY valid JSON (no markdown):\n" +
    '{"instagram": "url or null", "twitter": "url or null", "facebook": "url or null", "linkedin": "url or null", "youtube": ["url1", "url2"]}'
  );
}

export function buildSocialUrlFinderUserPrompt(
  brandName: string,
  domain: string,
  missing: string[]
) {
  return "Find the official " + missing.join(", ") + " for " + brandName + " (" + domain + ")";
}

export function buildExtractEmailsFromSourceSystemPrompt(
  brandName: string,
  platform: string
) {
  return (
    "You are an email extraction specialist. Visit the following " + platform +
    " page for the brand '" + brandName + "'. " +
    "Look at the bio, about section, description, contact info, and any visible text on the page. " +
    "Extract ALL email addresses you can find. Include obfuscated emails (like 'name at domain dot com', 'name [at] domain [dot] com') — convert them to standard format. " +
    "Return ONLY a JSON array of email strings. If no emails found, return []."
  );
}

export function buildExtractEmailsFromSourceUserPrompt(platform: string, url: string) {
  return "Visit this " + platform + " page and find all email addresses: " + url;
}

export function buildExtractEmailsFromYouTubeSystemPrompt() {
  return (
    "You are an email extraction specialist. Visit the following YouTube channel's About section. " +
    "Find ALL email addresses including: the business inquiry email (may require clicking 'View email address'), " +
    "any emails in the channel description, and any obfuscated emails (like 'name at domain dot com'). " +
    "Convert all to standard format. Return ONLY a JSON array of email strings. If no emails found, return []."
  );
}

export function buildExtractEmailsFromYouTubeUserPrompt(channelUrl: string) {
  return (
    "Visit this YouTube channel and find all email addresses from their About/description section: " +
    channelUrl
  );
}

export function buildEmailQualityCheckSystemPrompt(
  brandName: string,
  domain: string
) {
  return (
    "You are a data quality specialist for an influencer marketing agency. " +
    "I will give you the social media URLs and emails we found for a brand. Your job is to VERIFY and FIX:\n\n" +
    "1. CHECK EACH URL: Is it a real, active, official profile for this brand? " +
    "If a URL is clearly wrong (e.g., instagram.com/accounts, facebook.com/login, a dead page, or belongs to a different brand), " +
    "search the web and find the CORRECT official URL for that platform. If no official page exists, set it to null.\n\n" +
    "2. CHECK EMAILS: Remove any emails that are clearly not related to this brand (wrong domain, spam, test emails). " +
    "Keep all legitimate brand emails.\n\n" +
    "3. DEDUPLICATE: Remove duplicate emails across all sources.\n\n" +
    "Brand: " + brandName + "\nDomain: " + domain + "\n\n" +
    "Return ONLY valid JSON (no markdown) in this exact format:\n" +
    '{"instagram": {"url": "correct_url or null", "emails": ["email1", "email2"]}, ' +
    '"twitter": {"url": "correct_url or null", "emails": ["email1"]}, ' +
    '"facebook": {"url": "correct_url or null", "emails": []}, ' +
    '"linkedin": {"url": "correct_url or null", "emails": ["email1"]}, ' +
    '"youtube": [{"url": "channel_url", "emails": ["email1"]}], ' +
    '"website": {"url": "https://domain.com", "emails": ["email1", "email2"]}, ' +
    '"totalEmails": ["all unique verified emails"]}'
  );
}

export type EmailQualityCheckInput = {
  brandName: string;
  domain: string;
  instagramCell: string;
  twitterCell: string;
  facebookCell: string;
  linkedinCell: string;
  youtubeCell: string;
  websiteCell: string;
  totalEmailsCell: string;
};

export function buildEmailQualityCheckUserPrompt(input: EmailQualityCheckInput) {
  return (
    "Verify and fix the following data for brand '" + input.brandName + "' (" + input.domain + "):\n\n" +
    "Instagram cell:\n" + input.instagramCell + "\n\n" +
    "Twitter cell:\n" + input.twitterCell + "\n\n" +
    "Facebook cell:\n" + input.facebookCell + "\n\n" +
    "LinkedIn cell:\n" + input.linkedinCell + "\n\n" +
    "YouTube cell:\n" + input.youtubeCell + "\n\n" +
    "Website cell:\n" + input.websiteCell + "\n\n" +
    "Total emails cell:\n" + input.totalEmailsCell
  );
}