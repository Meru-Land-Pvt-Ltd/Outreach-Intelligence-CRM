import axios from "axios";
import { env } from "../config/env";

export async function callOpenAIWithWebSearch(
  promptOrSystem: string,
  optionalUserPrompt?: string
) {
  const prompt = optionalUserPrompt
    ? promptOrSystem + "\n\n" + optionalUserPrompt
    : promptOrSystem;

  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: env.openaiModel || "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      input: prompt,
      temperature: 0.2
    },
    {
      headers: {
        Authorization: "Bearer " + env.openaiApiKey,
        "Content-Type": "application/json"
      },
      timeout: 120000
    }
  );

  const data = response.data;

  if (data.output_text) {
    return String(data.output_text).trim();
  }

  const output = data.output || [];

  for (const item of output) {
    const content = item.content || [];

    for (const block of content) {
      if (block.text) {
        return String(block.text).trim();
      }
    }
  }

  return "";
}
