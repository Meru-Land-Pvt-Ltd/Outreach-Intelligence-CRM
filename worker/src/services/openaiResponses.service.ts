import axios from "axios";
import { env } from "../config/env";
import { getActiveAiConfig } from "./aiText.service";

// web_search is an OpenAI-only capability: when the Settings page has an
// OpenAI key saved, that key/model is used; otherwise it falls back to the
// legacy OPENAI_API_KEY env var.
export async function callOpenAIWithWebSearch(
  promptOrSystem: string,
  optionalUserPrompt?: string,
  model?: string
) {
  const prompt = optionalUserPrompt
    ? promptOrSystem + "\n\n" + optionalUserPrompt
    : promptOrSystem;

  const config = await getActiveAiConfig();
  const useSettings = config?.provider === "openai" && config.source === "settings";
  const apiKey = useSettings ? config!.apiKey : env.openaiApiKey;
  const defaultModel = useSettings ? config!.model : env.openaiModel || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error(
      "Web search needs an OpenAI API key (save an OpenAI key in Settings)."
    );
  }

  const response = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: model || defaultModel,
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      input: prompt,
      temperature: 0.2
    },
    {
      headers: {
        Authorization: "Bearer " + apiKey,
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
