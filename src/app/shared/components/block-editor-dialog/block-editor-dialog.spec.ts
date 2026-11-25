import { describe, expect, it } from 'vitest';
import { suggestBlockCode } from './block-editor-dialog';

describe('suggestBlockCode', () => {
  it('should generate clean short codes from single-word and multi-word titles', () => {
    expect(suggestBlockCode('Redes')).toBe('REDE');
    expect(suggestBlockCode('Historia Contemporánea')).toBe('HC');
    expect(suggestBlockCode('Organización del Estado')).toBe('OE');
    expect(suggestBlockCode('AWS Cloud Practitioner')).toBe('ACP');
    expect(suggestBlockCode('   ')).toBe('');
  });
});
