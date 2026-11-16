"use client";

import { useEffect, useState } from "react";

/**
 * Epoch milliseconds that tick every `interval_ms`, or null before the page
 * has mounted. Reading the clock during render would break prerendering, so
 * live durations and SLA countdowns go through this hook.
 */
export function useCurrentTime(interval_ms = 1000): number | null {
  const [current_time_ms, setCurrentTimeMs] = useState<number | null>(null);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTimeMs(Date.now());
    const first_tick_timer = setTimeout(updateCurrentTime, 0);
    const interval_timer = setInterval(updateCurrentTime, interval_ms);
    return () => {
      clearTimeout(first_tick_timer);
      clearInterval(interval_timer);
    };
  }, [interval_ms]);

  return current_time_ms;
}
