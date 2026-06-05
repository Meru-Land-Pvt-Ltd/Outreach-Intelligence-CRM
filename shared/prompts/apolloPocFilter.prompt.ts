export type ApolloContactPromptItem = {
  fullName: string;
  title: string;
};

export function buildApolloPocFilterPrompt(
  brandName: string,
  domain: string,
  allContacts: ApolloContactPromptItem[]
) {
  let contactListText = "";

  for (let cl = 0; cl < allContacts.length; cl++) {
    contactListText +=
      cl + 1 + ". " + allContacts[cl].fullName + " | " + allContacts[cl].title + "\n";
  }

  const aiPrompt =
    "You are an expert at influencer marketing outreach for a talent management agency called CollabGlam.\n\n" +
    "Below is a list of people who work at the brand \"" + brandName + "\" (" + domain + ").\n" +
    "Each line has: Number. Full Name | Job Title\n\n" +
    contactListText + "\n" +
    "Your task: Select the TOP 3 to 5 people most likely to APPROVE and CLOSE influencer marketing sponsorship deals for a YouTube channel.\n\n" +
    "ONLY pick people whose designation matches or is very close to these:\n" +
    "- Marketing Manager\n" +
    "- Brand Partnership Manager\n" +
    "- VP of Sales\n" +
    "- Sales Manager\n" +
    "- Marketing Head\n" +
    "- Influencer Manager\n" +
    "- Creator Manager\n" +
    "- Head of Marketing\n" +
    "- Director of Marketing\n" +
    "- Growth Manager\n" +
    "- Partnerships Manager\n" +
    "- Head of Growth\n\n" +
    "MUST AVOID these roles — they do NOT handle influencer deals:\n" +
    "- HR, Talent Management, Recruiting, People Operations\n" +
    "- Legal, Finance, Accounting\n" +
    "- Engineering, IT, DevOps, QA\n" +
    "- Operations, Supply Chain, Logistics\n" +
    "- Customer Support, Customer Success\n\n" +
    "You MUST return at least 2 people (if 2+ exist with matching roles). Maximum 5.\n" +
    "Return ONLY the original list numbers, one per line, ranked from best to worst.\n\n" +
    "Example response:\n3\n7\n1\n12\n5\n\n" +
    "No extra text. Just the numbers.";

  return aiPrompt;
}