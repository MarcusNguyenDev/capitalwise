import { Pause, Play, RotateCcw } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Badge } from "@/shared/ui/badge.component";
import { Button } from "@/shared/ui/button.component";

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
const KEYBOARD_SEEK_MS = 5000;

function toPercent(position_ms: number, duration_ms: number): string {
  return `${duration_ms === 0 ? 0 : Math.min(100, (position_ms / duration_ms) * 100)}%`;
}

/** Play, pause, restart, and a timeline you can click or move with the arrow keys. */
export function ReplayControls(controls: ReplayControlsProps) {
  const seekToClick = (click_event: MouseEvent<HTMLDivElement>) => {
    const bar_bounds = click_event.currentTarget.getBoundingClientRect();
    controls.onSeek(((click_event.clientX - bar_bounds.left) / bar_bounds.width) * controls.duration_ms);
  };

  const seekWithKeys = (key_event: KeyboardEvent<HTMLDivElement>) => {
    if (key_event.key === "ArrowRight" || key_event.key === "ArrowLeft") {
      key_event.preventDefault();
      controls.onSeek(controls.position_ms + (key_event.key === "ArrowRight" ? KEYBOARD_SEEK_MS : -KEYBOARD_SEEK_MS));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
      <Button
        variant="primary"
        className="w-28"
        icon={controls.is_playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        onClick={controls.onTogglePlayback}
      >
        {controls.is_finished ? "Replay" : controls.is_playing ? "Pause" : "Play"}
      </Button>
      <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={controls.onRestart}>
        Restart
      </Button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Replay position"
        aria-valuemin={0}
        aria-valuemax={controls.replay_events.length}
        aria-valuenow={controls.shown_event_count}
        aria-valuetext={`${controls.shown_event_count} of ${controls.replay_events.length} events`}
        className="relative h-3 min-w-40 flex-1 cursor-pointer rounded-full bg-surface"
        onClick={seekToClick}
        onKeyDown={seekWithKeys}
      >
        <div className="h-full rounded-full bg-ink/70" style={{ width: toPercent(controls.position_ms, controls.duration_ms) }} />
        {controls.replay_events.map((replay_event) => (
          <span
            key={replay_event.replay_key}
            className={`absolute top-1/2 h-2 w-0.5 -translate-y-1/2 ${MARKER_CLASS_NAMES[replay_event.kind]}`}
            style={{ left: toPercent(replay_event.replay_offset_ms, controls.duration_ms) }}
          />
        ))}
      </div>
      <span className="w-24 text-right text-sm tabular-nums text-ink-soft">
        {controls.shown_event_count} / {controls.replay_events.length}
      </span>
      <Badge>{REPLAY_SPEED}x speed</Badge>
    </div>
  );
}
