const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

// Removes <think>...</think> reasoning from streamed text. A tag may be split
// across chunks, so a possible partial tag at the end of a chunk is held back
// until the next chunk shows what it is.
export class ThinkBlockFilter {
  private pending_text = '';
  private is_inside_block = false;

  push(text_chunk: string): string {
    this.pending_text += text_chunk;
    let visible_text = '';
    while (this.pending_text.length > 0) {
      const tag = this.is_inside_block ? CLOSE_TAG : OPEN_TAG;
      const tag_index = this.pending_text.indexOf(tag);
      if (tag_index !== -1) {
        if (!this.is_inside_block) {
          visible_text += this.pending_text.slice(0, tag_index);
        }
        this.pending_text = this.pending_text.slice(tag_index + tag.length);
        this.is_inside_block = !this.is_inside_block;
        continue;
      }
      const held_length = this.measurePartialTagSuffix(tag);
      const releasable_text = this.pending_text.slice(
        0,
        this.pending_text.length - held_length,
      );
      if (!this.is_inside_block) {
        visible_text += releasable_text;
      }
      this.pending_text = this.pending_text.slice(releasable_text.length);
      break;
    }
    return visible_text;
  }

  // Whatever is left once the stream ends; an unclosed block is dropped.
  flush(): string {
    const remaining_text = this.is_inside_block ? '' : this.pending_text;
    this.pending_text = '';
    return remaining_text;
  }

  private measurePartialTagSuffix(tag: string): number {
    for (
      let prefix_length = Math.min(tag.length - 1, this.pending_text.length);
      prefix_length > 0;
      prefix_length--
    ) {
      if (this.pending_text.endsWith(tag.slice(0, prefix_length))) {
        return prefix_length;
      }
    }
    return 0;
  }
}
