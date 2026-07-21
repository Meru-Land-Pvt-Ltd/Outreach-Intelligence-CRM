import mongoose from "mongoose";

const InstantlyTemplateSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["Enoylity Technology", "MHD Tech"],
      required: true
    },

    // outbound = cold outreach to crawled leads (the original flow);
    // inbound = replies to leads who contacted us (CSV imports).
    templateType: {
      type: String,
      enum: ["outbound", "inbound"],
      default: "outbound"
    },

    subject: String,
    body: String,
    followUp1: String,
    followUp2: String
  },
  { timestamps: true }
);

InstantlyTemplateSchema.index({ channel: 1, templateType: 1 }, { unique: true });

export const InstantlyTemplate: any =
  mongoose.models.InstantlyTemplate ||
  mongoose.model("InstantlyTemplate", InstantlyTemplateSchema);
