"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

import { getCoreBaseUrl } from "@/shared/config/service_urls.config";

import { LIVE_MESSAGE } from "./live_event_names.constant";

export interface JoinRequest {
  role: "STAFF" | "PHONE";
  staff_id?: string;
  call_id?: string;
  customer_id?: string;
}

interface LiveSocketContextValue {
  socket: Socket | null;
  is_connected: boolean;
  joinRooms: (join_request: JoinRequest) => void;
}

const LiveSocketContext = createContext<LiveSocketContextValue>({
  socket: null,
  is_connected: false,
  joinRooms: () => undefined,
});

function buildJoinKey(join_request: JoinRequest): string {
  return [join_request.role, join_request.staff_id, join_request.call_id, join_request.customer_id].join("|");
}

/** One socket.io connection to `core` for the whole page. */
export function LiveSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [is_connected, setIsConnected] = useState(false);
  // Rooms are re-joined after every reconnect, otherwise a network blip
  // would silently stop the dashboard from updating.
  const join_requests_ref = useRef(new Map<string, JoinRequest>());

  useEffect(() => {
    const live_socket = io(getCoreBaseUrl(), { transports: ["websocket", "polling"] });
    const handleConnect = () => {
      for (const join_request of join_requests_ref.current.values()) {
        live_socket.emit(LIVE_MESSAGE.JOIN, join_request);
      }
      setIsConnected(true);
    };
    const handleDisconnect = () => setIsConnected(false);

    live_socket.on("connect", handleConnect);
    live_socket.on("disconnect", handleDisconnect);
    setSocket(live_socket);

    return () => {
      live_socket.off("connect", handleConnect);
      live_socket.off("disconnect", handleDisconnect);
      live_socket.disconnect();
    };
  }, []);

  const joinRooms = useCallback(
    (join_request: JoinRequest) => {
      join_requests_ref.current.set(buildJoinKey(join_request), join_request);
      if (socket?.connected) {
        socket.emit(LIVE_MESSAGE.JOIN, join_request);
      }
    },
    [socket],
  );

  const context_value = useMemo(() => ({ socket, is_connected, joinRooms }), [socket, is_connected, joinRooms]);

  return <LiveSocketContext.Provider value={context_value}>{children}</LiveSocketContext.Provider>;
}

export function useLiveSocket(): LiveSocketContextValue {
  return useContext(LiveSocketContext);
}
