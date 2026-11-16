/** The browser has no microphone, or the person declined the permission prompt. */
export class MicrophoneUnavailableError extends Error {
  constructor() {
    super("No microphone is available. Check the browser's microphone permission.");
    this.name = "MicrophoneUnavailableError";
  }
}
