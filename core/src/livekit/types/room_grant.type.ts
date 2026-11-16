export interface RoomGrant {
  room_name: string;
  identity: string;
  display_name: string;
  can_publish: boolean;
}

export interface MediaAvailability {
  is_available: boolean;
  // Why it is not available (null when it is).
  unavailable_reason: string | null;
}
