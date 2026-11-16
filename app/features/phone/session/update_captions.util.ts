import { MAX_VISIBLE_CAPTIONS } from "../constants/phone_call.constant";
import type { PhoneCaption } from "./phone_call_session.type";

/**
 * Adds a caption, or updates the one already on screen: streaming deltas
 * append, a final caption replaces. A new final caption also replaces the
 * text that was streaming in for the same speaker.
 */
export function updateCaptions(captions: PhoneCaption[], incoming_caption: PhoneCaption): PhoneCaption[] {
  const existing_caption = captions.find((caption) => caption.caption_id === incoming_caption.caption_id);
  if (!existing_caption) {
    const settled_captions = incoming_caption.is_final
      ? captions.filter((caption) => caption.is_final || caption.speaker !== incoming_caption.speaker)
      : captions;
    return [...settled_captions, incoming_caption].slice(-MAX_VISIBLE_CAPTIONS);
  }
  const updated_caption = incoming_caption.is_final
    ? incoming_caption
    : { ...existing_caption, text: existing_caption.text + incoming_caption.text };
  return captions.map((caption) => (caption === existing_caption ? updated_caption : caption));
}
