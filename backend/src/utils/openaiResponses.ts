import axios from "axios";
import { env } from "../config/env";

// OpenAI Responses API with the web_search tool. Ported from the worker's
// openaiResponses.service so the backend can run on-demand intent scans.
export async function callOpenAIWithWebSearch(prompt: string, model?: string) {
  const response = await axios.post(
    env.openaiResponsesUrl || "https://api.openai.com/v1/responses",
    {
      model: model || env.openaiModel || "gpt-4.1-mini",
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
