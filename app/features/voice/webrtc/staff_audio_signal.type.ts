/**
 * Payload of the `webrtc_signal` socket message for the direct audio link
 * between a supervisor (sender STAFF, always the offerer) and the customer's
 * phone (sender PHONE, always the answerer).
 */
export type StaffAudioSignal =
  | { kind: "offer"; sdp: string; staff_name: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit }
  | { kind: "hangup" };

export type StaffAudioLinkState = "CONNECTING" | "CONNECTED" | "FAILED" | "CLOSED";
