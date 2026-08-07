import mongoose from "mongoose";

// Singleton document (key: "ai") holding the AI provider configuration saved
// from the Settings page. The API key is stored AES-256-GCM encrypted; only
// the last 4 characters are kept in clear for masked display.
// Keep worker/src/models/AiSetting.model.ts identical.
const AiSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "ai"
    },
    provider: {
      type: String,
      enum: ["openai", "gemini", "anthropic"],
      default: "openai"
    },
    model: { type: String, default: "" },
    apiKeyEncrypted: { type: String, default: "" },
    apiKeyLast4: { type: String, default: "" },
    updatedBy: { type: String, default: "" }
  },
  { timestamps: true }
);

export const AiSetting =
  mongoose.models.AiSetting || mongoose.model("AiSetting", AiSettingSchema);
