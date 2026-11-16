import type { LiveCall } from "@/shared/types/call.type";

/** The channel and mode tag on tiles: how this conversation is reaching the bank. */
export function describeCallSource(call: Pick<LiveCall, "channel" | "metrics">): string {
  if (call.channel === "SIMULATED") {
    return "Simulated";
  }
  if (call.channel === "PHONE") {
    return "Phone";
  }
  return call.metrics?.mode === "LIVE" ? "Live voice" : "Scripted voice";
}
