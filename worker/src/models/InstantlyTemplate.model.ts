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

    // Multiple named templates per channel+type (e.g. "Sample 1"); the
    // template to use is picked at push time. Legacy rows become "Default".
    name: {
      type: String,
      default: "Default",
      trim: true
    },

    subject: String,
    body: String,
    followUp1: String,
    followUp2: String
  },
  { timestamps: true }
);

// ensureTemplates() drops the legacy unique indexes ({channel} and
// {channel, templateType}) at runtime so multiple named templates can coexist.
InstantlyTemplateSchema.index(
  { channel: 1, templateType: 1, name: 1 },
  { unique: true }
);

export const InstantlyTemplate: any =
  mongoose.models.InstantlyTemplate ||
  mongoose.model("InstantlyTemplate", InstantlyTemplateSchema);
