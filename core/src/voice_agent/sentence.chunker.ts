// A clause this long is spoken without waiting for the end of the sentence.
export const MAX_CHUNK_CHARACTERS = 120;

// A full stop after these is not the end of a sentence.
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'approx',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
]);

const SENTENCE_END_PATTERN = /[.!?…]+["')\]]*(?=\s)|\n+/g;
const CLAUSE_BREAK_PATTERN = /[,;:–—](?=\s)/g;

function endsWithAbbreviation(text_before_stop: string): boolean {
  const last_word = text_before_stop.trim().split(/\s+/).pop() ?? '';
  return ABBREVIATIONS.has(last_word.toLowerCase().replace(/\.$/, ''));
}

// Splits streamed model text into speakable chunks: whole sentences, or a
// clause once ~120 characters build up without a sentence end, so speech can
// start before the model has finished.
export class SentenceChunker {
  private pending_text = '';

  push(text_delta: string): string[] {
    this.pending_text += text_delta;
    const chunks: string[] = [];
    let next_chunk = this.takeNextChunk();
    while (next_chunk !== null) {
      if (next_chunk.length > 0) {
        chunks.push(next_chunk);
      }
      next_chunk = this.takeNextChunk();
    }
    return chunks;
  }

  // The rest of the text once the model is done (null when nothing is left).
  flush(): string | null {
    const remaining_text = this.pending_text.trim();
    this.pending_text = '';
    return remaining_text.length > 0 ? remaining_text : null;
  }

  private takeNextChunk(): string | null {
    const sentence_end = this.findSentenceEnd();
    if (sentence_end !== null) {
      return this.cutAt(sentence_end);
    }
    if (this.pending_text.length <= MAX_CHUNK_CHARACTERS) {
      return null;
    }
    return this.cutAt(this.findClauseEnd());
  }

  private findSentenceEnd(): number | null {
    for (const match of this.pending_text.matchAll(SENTENCE_END_PATTERN)) {
      const end_index = (match.index ?? 0) + match[0].length;
      const is_full_stop = match[0].startsWith('.');
      if (
        is_full_stop &&
        endsWithAbbreviation(this.pending_text.slice(0, match.index))
      ) {
        continue;
      }
      return end_index;
    }
    return null;
  }

  // The last clause break (or else space) within the length limit.
  private findClauseEnd(): number {
    const searchable_text = this.pending_text.slice(0, MAX_CHUNK_CHARACTERS);
    let clause_end = -1;
    for (const match of searchable_text.matchAll(CLAUSE_BREAK_PATTERN)) {
      clause_end = (match.index ?? 0) + match[0].length;
    }
    if (clause_end > 0) {
      return clause_end;
    }
    const last_space = searchable_text.lastIndexOf(' ');
    return last_space > 0 ? last_space : MAX_CHUNK_CHARACTERS;
  }

  private cutAt(end_index: number): string {
    const chunk = this.pending_text.slice(0, end_index).trim();
    this.pending_text = this.pending_text.slice(end_index).replace(/^\s+/, '');
    return chunk;
  }
}
