import axios from "axios";
import { env } from "../config/env";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(error: any, attempt: number) {
  const retryAfter = error?.response?.headers?.["retry-after"];

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }
  }

  return attempt * 5000;
}

export async function callOpenAIText(prompt: string) {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is missing in worker/.env");
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        env.openaiChatCompletionsUrl,
        {
          model: env.openaiModel,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0
        },
        {
          headers: {
            Authorization: "Bearer " + env.openaiApiKey,
            "Content-Type": "application/json"
          },
          timeout: 60000
        }
      );

      return response.data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message;

      console.error("OpenAI error:", status, message);

      if (status === 429 && attempt < maxAttempts) {
        const delayMs = getRetryDelayMs(error, attempt);
        console.log("OpenAI rate limited. Retrying in " + delayMs + "ms...");
        await sleep(delayMs);
        continue;
      }

      throw new Error("OpenAI request failed: " + status + " - " + message);
    }
  }

  throw new Error("OpenAI request failed after retries");
}
