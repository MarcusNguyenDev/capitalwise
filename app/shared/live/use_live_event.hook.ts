"use client";

import { useEffect, useEffectEvent } from "react";

import { useLiveSocket } from "./live_socket.provider";

/**
 * Subscribes to one or more live events from `core`.
 * Event names are listed in shared/live/live_event_names.constant.ts.
 */
export function useLiveEvent<Payload>(
  event_names: string | readonly string[],
  handleEvent: (payload: Payload, event_name: string) => void,
): void {
  const { socket } = useLiveSocket();
  const handleLatestEvent = useEffectEvent(handleEvent);
  const event_name_key = typeof event_names === "string" ? event_names : event_names.join(",");

  useEffect(() => {
    if (!socket) {
      return;
    }
    const subscribed_event_names = event_name_key.split(",");
    const listeners = subscribed_event_names.map((event_name) => {
      const listener = (payload: Payload) => handleLatestEvent(payload, event_name);
      socket.on(event_name, listener);
      return { event_name, listener };
    });
    return () => {
      for (const { event_name, listener } of listeners) {
        socket.off(event_name, listener);
      }
    };
  }, [socket, event_name_key]);
}
