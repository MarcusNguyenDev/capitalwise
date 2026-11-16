"use client";

import { useEffect, useState } from "react";

import { fetchCallDetail } from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { CALL_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { CallDetail, CallTurn, Intervention, LiveCall, TranscriptDelta } from "@/shared/types/call.type";

import type { InProgressLine } from "../transcript/transcript_entry.type";

function appendUnique<Item>(items: Item[], new_item: Item, readKey: (item: Item) => string | number): Item[] {
  return items.some((item) => readKey(item) === readKey(new_item)) ? items : [...items, new_item];
}

function mergeUnique<Item>(fetched_items: Item[], live_items: Item[], readKey: (item: Item) => string | number): Item[] {
  return live_items.reduce((merged_items, live_item) => appendUnique(merged_items, live_item, readKey), fetched_items);
}

function appendDelta(in_progress_lines: InProgressLine[], transcript_delta: TranscriptDelta): InProgressLine[] {
  const is_known = in_progress_lines.some((line) => line.item_id === transcript_delta.item_id);
  if (!is_known) {
    return [...in_progress_lines, { item_id: transcript_delta.item_id, speaker: transcript_delta.speaker, text: transcript_delta.delta }];
  }
  return in_progress_lines.map((line) => (line.item_id === transcript_delta.item_id ? { ...line, text: line.text + transcript_delta.delta } : line));
}

const readTurnKey = (turn: CallTurn) => turn.turn_id;
const readInterventionKey = (intervention: Intervention) => intervention.intervention_id;

export interface LiveCallDetail {
  call: LiveCall | null;
  turns: CallTurn[];
  interventions: Intervention[];
  in_progress_lines: InProgressLine[];
  is_loading: boolean;
  error_message: string | null;
}

/**
 * One call's transcript and state, loaded once and then kept current from
 * live events. Mount it with `key={call_id}` so each call starts clean.
 */
export function useCallDetail(call_id: string): LiveCallDetail {
  const [call, setCall] = useState<LiveCall | null>(null);
  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [in_progress_lines, setInProgressLines] = useState<InProgressLine[]>([]);
  const [is_loading, setIsLoading] = useState(true);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const { is_connected } = useLiveSocket();

  useEffect(() => {
    let is_cancelled = false;
    const applyCallDetail = (call_detail: CallDetail) => {
      // Events that arrived while the request was in flight are kept.
      setCall(call_detail.call);
      setTurns((live_turns) => mergeUnique(call_detail.turns, live_turns, readTurnKey));
      setInterventions((live_interventions) => mergeUnique(call_detail.interventions, live_interventions, readInterventionKey));
      setErrorMessage(null);
    };
    fetchCallDetail(call_id)
      .then((call_detail) => !is_cancelled && applyCallDetail(call_detail))
      .catch((error) => !is_cancelled && setErrorMessage(describeError(error)))
      .finally(() => !is_cancelled && setIsLoading(false));
    return () => {
      is_cancelled = true;
    };
    // Reloading after a reconnect fills in anything missed while offline.
  }, [call_id, is_connected]);

  useLiveEvent<LiveCall>(CALL_EVENTS, (updated_call) => {
    if (updated_call.call_id === call_id) {
      setCall(updated_call);
    }
  });

  useLiveEvent<CallTurn>(LIVE_EVENT.CALL_TURN, (turn) => {
    if (turn.call_id !== call_id) {
      return;
    }
    setTurns((current_turns) => appendUnique(current_turns, turn, readTurnKey));
    // The stored turn replaces the text that was streaming in for that speaker.
    setInProgressLines((current_lines) => current_lines.filter((line) => line.speaker !== turn.speaker));
  });

  useLiveEvent<TranscriptDelta>(LIVE_EVENT.CALL_TRANSCRIPT_DELTA, (transcript_delta) => {
    if (transcript_delta.call_id === call_id) {
      setInProgressLines((current_lines) => appendDelta(current_lines, transcript_delta));
    }
  });

  useLiveEvent<Intervention>(LIVE_EVENT.CALL_INTERVENTION, (intervention) => {
    if (intervention.call_id === call_id) {
      setInterventions((current_interventions) => appendUnique(current_interventions, intervention, readInterventionKey));
    }
  });

  return { call, turns, interventions, in_progress_lines, is_loading, error_message };
}
