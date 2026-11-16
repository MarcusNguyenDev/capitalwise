import type { MouseEvent } from "react";

import { Button } from "@/shared/ui/button.component";
import { Chip } from "@/shared/ui/chip.component";

import { REPLAY_SPEED } from "../constants/replay.constant";
import type { ReplayEvent } from "../utils/compress_timeline_gaps.util";

interface ReplayControlsProps {
  replay_events: ReplayEvent[];
  duration_ms: number;
  position_ms: number;
  shown_event_count: number;
  is_playing: boolean;
  is_finished: boolean;
  onTogglePlayback: () => void;
  onRestart: () => void;
  onSeek: (position_ms: number) => void;
}

const MARKER_CLASS_NAMES: Record<ReplayEvent["kind"], string> = { TURN: "bg-ink-faint", TOOL: "bg-info", INTERVENTION: "bg-warning" };

function toPercent(position_ms: number, duration_ms: number): string {
  return `${duration_ms === 0 ? 0 : Math.min(100, (position_ms / duration_ms) * 100)}%`;
}

export function ReplayControls(controls: ReplayControlsProps) {
  const seekToClick = (click_event: MouseEvent<HTMLDivElement>) => {
    const bar_bounds = click_event.currentTarget.getBoundingClientRect();
    controls.onSeek(((click_event.clientX - bar_bounds.left) / bar_bounds.width) * controls.duration_ms);
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4">
      <Button variant="primary" className="w-28" onClick={controls.onTogglePlayback}>
        {controls.is_finished ? "↻ Replay" : controls.is_playing ? "❚❚ Pause" : "▶ Play"}
      </Button>
      <Button onClick={controls.onRestart}>Restart</Button>
      <div
        role="progressbar"
        aria-label="Replay progress"
        aria-valuemin={0}
        aria-valuemax={controls.replay_events.length}
        aria-valuenow={controls.shown_event_count}
        className="relative h-4 flex-1 cursor-pointer rounded-full bg-surface"
        onClick={seekToClick}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: toPercent(controls.position_ms, controls.duration_ms) }} />
        {controls.replay_events.map((replay_event) => (
          <span
            key={replay_event.replay_key}
            className={`absolute top-1/2 h-2 w-0.5 -translate-y-1/2 ${MARKER_CLASS_NAMES[replay_event.kind]}`}
            style={{ left: toPercent(replay_event.replay_offset_ms, controls.duration_ms) }}
          />
        ))}
      </div>
      <span className="w-32 text-right font-mono tabular-nums text-ink-soft">
        {controls.shown_event_count} / {controls.replay_events.length} events
      </span>
      <Chip tone="dark">{REPLAY_SPEED}x speed</Chip>
    </div>
  );
}
