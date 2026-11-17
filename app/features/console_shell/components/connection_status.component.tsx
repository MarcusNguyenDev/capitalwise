"use client";

import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

/** Whether live updates are flowing. Only draws attention when they are not. */
export function ConnectionStatus() {
  const { is_connected } = useLiveSocket();
  return (
    <p role="status" className={joinClassNames("flex items-center gap-2 text-xs", is_connected ? "text-ink-faint" : "font-semibold text-warning")}>
      <span className={joinClassNames("size-2 rounded-full", is_connected ? "bg-positive" : "animate-pulse-dot bg-warning")} aria-hidden />
      {is_connected ? "Live updates on" : "Reconnecting to live updates…"}
    </p>
  );
}
