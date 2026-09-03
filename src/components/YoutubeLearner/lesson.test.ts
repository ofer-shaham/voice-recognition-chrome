import { describe, expect, it } from 'vitest';
import { buildMinimalMaskPrompt, parseMaskRows } from './lesson';

describe('lesson mask helpers', () => {
  it('builds a minimal prompt that asks for exactly X words and no extra output', () => {
    const prompt = buildMinimalMaskPrompt('This is a sample caption sentence for testing.', 3);

    expect(prompt).toBe('Generate 3 words sentence based on the words:\n\nThis is a sample caption sentence for testing.');
  });

  it('normalizes plain response lines to the exact requested word count', () => {
    expect(parseMaskRows('This is a full line of text\nAnother line that is longer than expected', 3)).toEqual([
      'This is a',
      'Another line',
    ]);
  });
});
