import { RunLog } from "../models/RunLog.model";

const RunLogModel = RunLog as any;

export async function addRunLog(input: {
  module: string;
  message: string;
  level?: "info" | "error" | "success" | "warning";
  raw?: any;
}) {
  const line =
    new Date().toLocaleString() +
    " - " +
    input.module +
    " - " +
    input.message;

  await RunLogModel.create({
    latestLog: input.level === "error" ? "" : line,
    failedExecution: input.level === "error" ? line : "",
    module: input.module,
    level: input.level || "info",
    message: input.message,
    raw: input.raw || {}
  });
}

export async function logStart(module: string) {
  await addRunLog({
    module,
    message: "START",
    level: "info"
  });
}

export async function logDone(module: string, message = "DONE") {
  await addRunLog({
    module,
    message,
    level: "success"
  });
}

export async function logError(module: string, message: string, raw?: any) {
  await addRunLog({
    module,
    message,
    level: "error",
    raw
  });
}
