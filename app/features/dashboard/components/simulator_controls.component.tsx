"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";

import { DEFAULT_SIMULATOR_CALL_COUNT, SIMULATOR_CALL_COUNT_OPTIONS, SIMULATOR_SPEED_OPTIONS } from "../constants/dashboard.constant";
import { useSimulator } from "../hooks/use_simulator.hook";

export function SimulatorControls() {
  const [call_count, setCallCount] = useState<number>(DEFAULT_SIMULATOR_CALL_COUNT);
  const simulator = useSimulator();
  const is_running = simulator.simulator_status?.is_running ?? false;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-2.5">
      <span className="flex items-center gap-2 font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${is_running ? "animate-pulse bg-positive" : "bg-ink-faint"}`} />
        Simulator
      </span>
      <label className="flex items-center gap-2 text-ink-soft">
        Calls
        <select
          className="rounded-lg border border-line bg-white px-2 py-1.5 font-semibold text-ink"
          value={call_count}
          disabled={is_running}
          onChange={(change_event) => setCallCount(Number(change_event.target.value))}
        >
          {SIMULATOR_CALL_COUNT_OPTIONS.map((count_option) => (
            <option key={count_option} value={count_option}>
              {count_option}
            </option>
          ))}
        </select>
      </label>
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label="Simulation speed">
        {SIMULATOR_SPEED_OPTIONS.map((speed_option) => (
          <button
            key={speed_option}
            type="button"
            role="radio"
            aria-checked={simulator.speed === speed_option}
            disabled={simulator.is_busy}
            onClick={() => simulator.changeSpeed(speed_option)}
            className={`rounded-md px-3 py-1 font-semibold ${simulator.speed === speed_option ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {speed_option}x
          </button>
        ))}
      </div>
      {is_running ? (
        <Button variant="danger" disabled={simulator.is_busy} onClick={simulator.stop}>
          Stop
        </Button>
      ) : (
        <Button variant="primary" disabled={simulator.is_busy} onClick={() => simulator.start(call_count)}>
          Start simulation
        </Button>
      )}
    </div>
  );
}
