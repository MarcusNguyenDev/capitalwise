import { AI_SPECIALIST_IDENTITY, CUSTOMER_IDENTITY } from "./call_room.constant";
import type { CallRoomRole } from "./call_room.type";

export function describeCallRoomRole(identity: string): CallRoomRole {
  if (identity === CUSTOMER_IDENTITY) {
    return "CUSTOMER";
  }
  return identity === AI_SPECIALIST_IDENTITY ? "AI_SPECIALIST" : "STAFF";
}
