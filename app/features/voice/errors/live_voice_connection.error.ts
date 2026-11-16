/** The WebRTC session with the realtime voice model could not be set up or dropped mid-call. */
export class LiveVoiceConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveVoiceConnectionError";
  }
}
