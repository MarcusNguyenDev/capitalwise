"use client";

import { Play, Square } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button.component";
import { joinClassNames } from "@/shared/ui/join_class_names.util";
import { Popover } from "@/shared/ui/popover.component";
import { SegmentedControl } from "@/shared/ui/segmented_control.component";

import { DEFAULT_SIMULATOR_CALL_COUNT, SIMULATOR_CALL_COUNT_OPTIONS, SIMULATOR_SPEED_OPTIONS } from "../constants/live_calls.constant";
import { useSimulator } from "../hooks/use_simulator.hook";

/** Demo traffic, kept behind one button so it never competes with real work. */
export function SimulatorPopover() {
  const [call_count, setCallCount] = useState<number>(DEFAULT_SIMULATOR_CALL_COUNT);
  const [is_open, setIsOpen] = useState(false);
  const simulator = useSimulator();
  const is_running = simulator.simulator_status?.is_running ?? false;

  return (
    <Popover
      label="Call simulator"
      is_open={is_open}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          icon={<span className={joinClassNames("size-2 rounded-full", is_running ? "animate-pulse-dot bg-positive" : "bg-ink-faint")} aria-hidden />}
        >
          {is_running ? "Simulator running" : "Simulator"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold">Call simulator</p>
          <p className="mt-0.5 text-sm text-ink-soft">Text-only demo calls that go through the same tools, policy engine and audit trail as real ones.</p>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-faint">
            Calls
            <select
              className="h-8 rounded-md border border-line-strong bg-white px-2 text-sm font-semibold text-ink"
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
          <div className="flex flex-col gap-1 text-xs font-medium text-ink-faint">
            Speed
            <SegmentedControl
              label="Simulation speed"
              value={simulator.speed}
              is_disabled={simulator.is_busy}
              options={SIMULATOR_SPEED_OPTIONS.map((speed_option) => ({ value: speed_option, label: `${speed_option}x` }))}
              onChange={simulator.changeSpeed}
            />
          </div>
        </div>
        {is_running ? (
          <Button variant="danger" icon={<Square className="size-4" aria-hidden />} is_loading={simulator.is_busy} onClick={() => {
              simulator.stop();
              setIsOpen(false);
            }}>
            Stop the simulation
          </Button>
        ) : (
          <Button variant="primary" icon={<Play className="size-4" aria-hidden />} is_loading={simulator.is_busy} onClick={() => {
              simulator.start(call_count);
              setIsOpen(false);
            }}>
            Start {call_count} {call_count === 1 ? "call" : "calls"}
          </Button>
        )}
      </div>
    </Popover>
  );
}
