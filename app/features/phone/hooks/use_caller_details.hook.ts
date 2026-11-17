"use client";

import { fetchCallerDetails } from "@/shared/api_client/engine_api.client";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { LiveQuery } from "@/shared/live/use_live_query.hook";
import type { CallerDetails } from "@/shared/types/resources.type";

const NO_REFRESH_EVENTS: readonly string[] = [];

/** The caller's own details. A new `refresh_key` reloads them (a replaced card shows after the call). */
export function useCallerDetails(customer_id: string, refresh_key = ""): LiveQuery<CallerDetails> {
  return useLiveQuery<CallerDetails>(() => fetchCallerDetails(customer_id), NO_REFRESH_EVENTS, `${customer_id}:${refresh_key}`);
}
