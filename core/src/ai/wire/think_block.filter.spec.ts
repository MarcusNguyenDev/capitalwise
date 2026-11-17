import { parseToolArguments } from './parse_tool_arguments.util';
import { ThinkBlockFilter } from './think_block.filter';

function filterChunks(text_chunks: string[]): string {
  const think_block_filter = new ThinkBlockFilter();
  const visible_text = text_chunks
    .map((text_chunk) => think_block_filter.push(text_chunk))
    .join('');
  return visible_text + think_block_filter.flush();
}

describe('ThinkBlockFilter', () => {
  it('passes text without tags straight through', () => {
    expect(filterChunks(['Hello ', 'there.'])).toBe('Hello there.');
  });

  it('removes a block whose tags are split across chunks', () => {
    expect(filterChunks(['Hi <', 'th', 'ink>secret</', 'think> Sarah'])).toBe(
      'Hi  Sarah',
    );
  });

  it('holds back a possible partial tag until it is resolved', () => {
    const think_block_filter = new ThinkBlockFilter();

    expect(think_block_filter.push('Costs < ')).toBe('Costs < ');
    expect(think_block_filter.push('5 dollars <t')).toBe('5 dollars ');
    expect(think_block_filter.push('ea')).toBe('<tea');
  });

  it('drops an unclosed block at the end', () => {
    expect(filterChunks(['Answer.<think>never closed'])).toBe('Answer.');
  });

  it('removes several blocks', () => {
    expect(filterChunks(['<think>a</think>One. <think>b</think>Two.'])).toBe(
      'One. Two.',
    );
  });
});

describe('parseToolArguments', () => {
  it('accepts an object, a JSON string, and turns anything else into {}', () => {
    expect(parseToolArguments({ card_id: 'CRD-1' })).toEqual({
      card_id: 'CRD-1',
    });
    expect(parseToolArguments('{"hours":72}')).toEqual({ hours: 72 });
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('{broken')).toEqual({});
    expect(parseToolArguments('[1,2]')).toEqual({});
    expect(parseToolArguments(null)).toEqual({});
  });
});
