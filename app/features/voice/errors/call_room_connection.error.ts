/** The call's LiveKit audio room could not be joined, or the connection dropped mid-call. */
export class CallRoomConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallRoomConnectionError";
  }
}
