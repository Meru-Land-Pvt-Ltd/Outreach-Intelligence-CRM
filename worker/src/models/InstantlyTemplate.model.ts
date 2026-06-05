import mongoose from "mongoose";

const InstantlyTemplateSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["Enoylity Technology", "MHD Tech"],
      required: true,
      unique: true
    },

    subject: String,
    body: String,
    followUp1: String,
    followUp2: String
  },
  { timestamps: true }
);

export const InstantlyTemplate: any =
  mongoose.models.InstantlyTemplate ||
  mongoose.model("InstantlyTemplate", InstantlyTemplateSchema);
