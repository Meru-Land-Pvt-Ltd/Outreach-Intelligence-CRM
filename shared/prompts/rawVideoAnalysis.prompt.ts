export type RawVideoPromptItem = {
  channelName: string;
  title: string;
  duration: number | string;
  description: string;
};

export function buildRawVideoAnalysisPrompt(batch: RawVideoPromptItem[]) {
  let prompt =
    "For each video below, analyze the title, description, and duration to extract:\n" +
    "1. Channel Category — What type of channel is this? Be specific. " +
    "Examples: Tech Reviews, Outdoor/Camping, DIY/Home Improvement, Automotive, Gaming, Lifestyle, Vlog, etc. " +
    "Use 1-3 words max.\n" +
    "2. Sponsor Brand — What is the PRIMARY brand being featured or reviewed in this video?\n" +
    "Extract ONLY ONE brand name. Even if multiple brands are mentioned or compared, pick the MAIN one " +
    "that the video is primarily about. If no identifiable brand is present, write 'None'.\n" +
    "3. Promo Code — Any discount/promo code mentioned in the description. If none, write 'N/A'.\n" +
    "4. Product Name (with model) — Exact product name with model number as mentioned " +
    "(e.g., 'VTOMAN Jump 600X', 'EcoFlow Delta 2 Max'). If no specific product, write 'N/A'.\n" +
    "5. Sponsorship Type — Based on duration and content:\n" +
    " - Dedicated Review (5+ min video fully about one product)\n" +
    " - Comparison (multiple products compared)\n" +
    " - Integration (brand mentioned within a longer video about something else)\n" +
    " - Affiliate (has affiliate links/codes but not a full review)\n" +
    " - Unboxing (first look, unboxing focused)\n" +
    " - Mention (brief mention, under 2 min or just in description)\n" +
    " If no brand found, write 'N/A'.\n\n" +
    "IMPORTANT: Only ONE brand per line. Never combine multiple brands.\n\n" +
    "RESPOND in this EXACT format, one line per video, pipe-separated, no extra text:\n" +
    "VideoNumber|Channel Category|Sponsor Brand|Promo Code|Product Name (with model)|Sponsorship Type\n\n" +
    "VIDEOS TO ANALYZE:\n";

  for (let v = 0; v < batch.length; v++) {
    prompt += "\nVideo " + (v + 1) + ":\n";
    prompt += "Channel: " + batch[v].channelName + "\n";
    prompt += "Title: " + batch[v].title + "\n";
    prompt += "Duration: " + batch[v].duration + " seconds\n";
    prompt += "Description: " + String(batch[v].description || "").substring(0, 1000) + "\n";
  }

  return prompt;
}