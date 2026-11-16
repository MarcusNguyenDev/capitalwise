// Shape of the JSON messages the api service publishes on the Redis channel.
export interface LiveEventMessage {
  event: string;
  payload: Record<string, unknown>;
  rooms: string[];
}
