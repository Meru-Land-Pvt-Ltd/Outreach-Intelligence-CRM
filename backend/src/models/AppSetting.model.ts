import mongoose from "mongoose";

const AppSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "global"
    }
  },
  { timestamps: true, strict: false }
);

export const AppSetting =
  mongoose.models.AppSetting ||
  mongoose.model("AppSetting", AppSettingSchema);
