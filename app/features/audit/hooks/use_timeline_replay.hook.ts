"use client";

import { useEffect, useState } from "react";

import { REPLAY_SPEED, REPLAY_TICK_MS } from "../constants/replay.constant";

/** A playhead that advances through `duration_ms` of call time at the replay speed. */
export function useTimelineReplay(duration_ms: number) {
  const [position_ms, setPositionMs] = useState(0);
  const [is_paused, setIsPaused] = useState(false);
  const is_finished = position_ms >= duration_ms;
  const is_playing = !is_paused && !is_finished;

  useEffect(() => {
    if (!is_playing) {
      return;
    }
    const tick_timer = setInterval(
      () => setPositionMs((current_position_ms) => Math.min(duration_ms, current_position_ms + REPLAY_TICK_MS * REPLAY_SPEED)),
      REPLAY_TICK_MS,
    );
    return () => clearInterval(tick_timer);
  }, [is_playing, duration_ms]);

  const seekTo = (target_position_ms: number) => setPositionMs(Math.max(0, Math.min(duration_ms, target_position_ms)));
  const restart = () => {
    setPositionMs(0);
    setIsPaused(false);
  };
  const togglePlayback = () => (is_finished ? restart() : setIsPaused((was_paused) => !was_paused));

  return { position_ms, is_playing, is_finished, seekTo, restart, togglePlayback };
}
