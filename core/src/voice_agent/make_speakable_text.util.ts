// Everything the model writes is read aloud: remove markdown, list markers,
// emojis and stray symbols a voice would either skip or spell out.
export function makeSpeakableText(model_text: string): string {
  return model_text
    .replace(/<\/?think>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/gm, '')
    .replace(/\*+/g, '')
    .replace(/_+/g, ' ')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/%/g, ' percent')
    .replace(/[<>{}[\]|^~=\\#*]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}
