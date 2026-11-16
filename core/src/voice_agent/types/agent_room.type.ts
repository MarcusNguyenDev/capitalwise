export interface AgentRoomListeners {
  // 16 kHz mono 16-bit frames of the `customer` participant's microphone.
  onCustomerAudioFrame: (frame: Int16Array) => void;
  // True once the customer's audio track is subscribed, false when the
  // customer leaves the room.
  onCustomerPresenceChanged: (is_present: boolean) => void;
  // The agent itself lost the room (server gone, room deleted).
  onDisconnected: () => void;
}

// The voice agent's view of its call room. The LiveKit implementation lives
// in livekit_agent.room.ts; tests use an in-memory fake.
export interface AgentRoom {
  join(listeners: AgentRoomListeners): Promise<void>;
  // One 10 ms frame of 24 kHz mono 16-bit PCM for the agent's track. Resolves
  // once the frame is queued (blocks while about a second is already queued).
  captureFrame(frame: Int16Array): Promise<void>;
  // Drops audio already queued for playout (barge-in).
  clearQueue(): void;
  readQueuedDurationMs(): number;
  leave(): Promise<void>;
}
