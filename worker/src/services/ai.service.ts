import { generateAiText } from "./aiText.service";

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

// Text generation via the AI provider/model configured in Settings
// (OpenAI, Gemini or Claude), with the same rate-limit retry behavior the
// old OpenAI-only version had.
export async function callOpenAIText(prompt: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateAiText({ prompt, temperature: 0 });
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message;

      console.error("AI error:", status, message);

      if (status === 429 && attempt < maxAttempts) {
        const delayMs = getRetryDelayMs(error, attempt);
        console.log("AI rate limited. Retrying in " + delayMs + "ms...");
        await sleep(delayMs);
        continue;
      }

      throw new Error("AI request failed: " + (status || "") + " - " + message);
    }
  }

  throw new Error("AI request failed after retries");
}
