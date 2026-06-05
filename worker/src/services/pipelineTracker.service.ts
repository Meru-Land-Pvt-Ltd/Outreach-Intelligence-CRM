import { PipelineTracker } from "../models/PipelineTracker.model";

export async function addPipelineTrackerLog(input: {
  type: "Seed" | "Discovered";
  brandName?: string;
  domain?: string;
  status: string;
}) {
  return PipelineTracker.create({
    type: input.type,
    brandName: input.brandName || "",
    domain: input.domain || "",
    status: input.status,
    timestamp: new Date()
  });
}
