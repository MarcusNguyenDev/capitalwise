"use client";

import { fetchScriptedCalls, fetchVoiceStatus } from "@/shared/api_client/core_api.client";
import { fetchCallers } from "@/shared/api_client/engine_api.client";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { CallScriptSummary, VoiceStatus } from "@/shared/types/call.type";
import type { Caller } from "@/shared/types/resources.type";

const NO_REFRESH_EVENTS: readonly string[] = [];

export interface CallerDirectory {
  callers: Caller[];
  scripted_customer_ids: string[];
  is_live_available: boolean;
  is_loading: boolean;
  error_message: string | null;
}

/** Who can call, which callers have a scripted replay, and whether live voice is configured. */
export function useCallerDirectory(): CallerDirectory {
  const callers_query = useLiveQuery<Caller[]>(fetchCallers, NO_REFRESH_EVENTS);
  const scripts_query = useLiveQuery<CallScriptSummary[]>(fetchScriptedCalls, NO_REFRESH_EVENTS);
  const voice_status_query = useLiveQuery<VoiceStatus>(fetchVoiceStatus, NO_REFRESH_EVENTS);

  return {
    callers: callers_query.data ?? [],
    scripted_customer_ids: (scripts_query.data ?? []).map((script_summary) => script_summary.customer_id),
    is_live_available: voice_status_query.data?.is_live_available ?? false,
    is_loading: callers_query.is_loading,
    error_message: callers_query.error_message,
  };
}
