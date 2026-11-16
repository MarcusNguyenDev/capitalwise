// What a browser needs to join a call's LiveKit room.
export interface VoiceRoomAccess {
  room_name: string;
  livekit_url: string | null;
  token: string;
  identity: string;
}
