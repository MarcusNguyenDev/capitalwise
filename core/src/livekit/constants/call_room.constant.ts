// One LiveKit room per call, and fixed participant identities in it.
export const CALL_ROOM_PREFIX = 'call_';
export const CUSTOMER_IDENTITY = 'customer';
export const AI_AGENT_IDENTITY = 'ai_specialist';
export const AI_AGENT_DISPLAY_NAME = 'AI specialist';
export const STAFF_IDENTITY_PREFIX = 'staff_';

export function buildCallRoomName(call_id: string): string {
  return `${CALL_ROOM_PREFIX}${call_id}`;
}

export function buildStaffIdentity(staff_id: string): string {
  return `${STAFF_IDENTITY_PREFIX}${staff_id}`;
}
