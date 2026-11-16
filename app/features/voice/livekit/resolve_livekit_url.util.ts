import { DEFAULT_LIVEKIT_PORT } from "./call_room.constant";

/** `core` returns null when LiveKit sits on the same host as the page (a second device on the LAN included). */
export function resolveLivekitUrl(livekit_url: string | null): string {
  if (livekit_url) {
    return livekit_url;
  }
  const websocket_protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${websocket_protocol}//${window.location.hostname}:${DEFAULT_LIVEKIT_PORT}`;
}
