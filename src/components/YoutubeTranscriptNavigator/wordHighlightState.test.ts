import { describe, expect, it } from 'vitest';
import { isActiveWordForCell } from './YoutubeTranscriptParser';

describe('isActiveWordForCell', () => {
    it('only matches the active row and column', () => {
        const activeWord = { gi: 4, col: 'source', charIndex: 3, charLength: 4 };

        expect(isActiveWordForCell(activeWord, 4, 'source')).toBe(true);
        expect(isActiveWordForCell(activeWord, 4, 'translation')).toBe(false);
        expect(isActiveWordForCell(activeWord, 5, 'source')).toBe(false);
    });
});
