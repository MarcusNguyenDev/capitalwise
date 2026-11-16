"use client";

import { useEffect, useState } from "react";

import { fetchLiveCalls } from "@/shared/api_client/core_api.client";
import { applyCallHold } from "@/shared/call_hold/apply_call_hold.util";
import { describeError } from "@/shared/http/service_request.error";
import { CALL_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { CallHoldEvent, CallTurn, LiveCall } from "@/shared/types/call.type";

import { ENDED_CALL_LINGER_MS } from "../constants/dashboard.constant";

function upsertCall(live_calls: LiveCall[], call: LiveCall): LiveCall[] {
  const is_known = live_calls.some((known_call) => known_call.call_id === call.call_id);
  return is_known ? live_calls.map((known_call) => (known_call.call_id === call.call_id ? call : known_call)) : [...live_calls, call];
}

/** A fresh list from the server replaces the live calls but keeps ended tiles that are still lingering. */
function mergeFetchedCalls(current_calls: LiveCall[], fetched_calls: LiveCall[]): LiveCall[] {
  const fetched_call_ids = new Set(fetched_calls.map((call) => call.call_id));
  const lingering_calls = current_calls.filter((call) => call.status === "ENDED" && !fetched_call_ids.has(call.call_id));
  return [...fetched_calls, ...lingering_calls];
}

function applyTurn(live_calls: LiveCall[], turn: CallTurn): LiveCall[] {
  // Tool calls and staff-only notes are not something the customer or AI said.
  if (!turn.text || turn.speaker === "SYSTEM") {
    return live_calls;
  }
  return live_calls.map((call) => (call.call_id === turn.call_id ? { ...call, last_line: turn.text, last_speaker: turn.speaker } : call));
}

export interface LiveCalls {
  live_calls: LiveCall[];
  is_loading: boolean;
  error_message: string | null;
}

/** The active calls, loaded once and then kept in local state from live events rather than refetched per turn. */
export function useLiveCalls(): LiveCalls {
  const [live_calls, setLiveCalls] = useState<LiveCall[]>([]);
  const [is_loading, setIsLoading] = useState(true);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [reload_count, setReloadCount] = useState(0);
  const { is_connected } = useLiveSocket();

  useEffect(() => {
    let is_cancelled = false;
    fetchLiveCalls()
      .then((fetched_calls) => {
        if (!is_cancelled) {
          setLiveCalls((current_calls) => mergeFetchedCalls(current_calls, fetched_calls));
          setErrorMessage(null);
        }
      })
      .catch((error) => !is_cancelled && setErrorMessage(describeError(error)))
      .finally(() => !is_cancelled && setIsLoading(false));
    return () => {
      is_cancelled = true;
    };
    // Reloading after a reconnect picks up calls that started or ended while offline.
  }, [is_connected, reload_count]);

  useLiveEvent<LiveCall>(CALL_EVENTS, (call) => {
    setLiveCalls((current_calls) => upsertCall(current_calls, call));
    if (call.status === "ENDED") {
      setTimeout(() => {
        setLiveCalls((current_calls) => current_calls.filter((known_call) => known_call.call_id !== call.call_id || known_call.status !== "ENDED"));
      }, ENDED_CALL_LINGER_MS);
    }
  });

  useLiveEvent<CallTurn>(LIVE_EVENT.CALL_TURN, (turn) => {
    setLiveCalls((current_calls) => applyTurn(current_calls, turn));
  });

  useLiveEvent<CallHoldEvent>(LIVE_EVENT.CALL_HOLD, (hold_event) => {
    setLiveCalls((current_calls) => current_calls.map((call) => (call.call_id === hold_event.call_id ? applyCallHold(call, hold_event) : call)));
  });

  useLiveEvent(LIVE_EVENT.DEMO_RESET, () => {
    setLiveCalls([]);
    setReloadCount((current_count) => current_count + 1);
  });

  return { live_calls, is_loading, error_message };
}
