import { MicrophoneUnavailableError } from "../errors/microphone_unavailable.error";

/** Echo cancellation matters here: the phone plays the AI and staff audio through its speakers. */
export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneUnavailableError();
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new MicrophoneUnavailableError();
  }
}

export function stopMediaStream(media_stream: MediaStream | null): void {
  for (const track of media_stream?.getTracks() ?? []) {
    track.stop();
  }
}
