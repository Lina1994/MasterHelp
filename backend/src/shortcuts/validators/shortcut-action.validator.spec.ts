import { BadRequestException } from '@nestjs/common';
import { normalizeHotkey, validateAndNormalizeShortcutActions } from './shortcut-action.validator';

describe('shortcut-action.validator', () => {
  describe('normalizeHotkey', () => {
    it('normalizes and sorts modifier keys deterministically', () => {
      expect(normalizeHotkey('Shift+Ctrl+X')).toBe('ctrl+shift+x');
      expect(normalizeHotkey(' alt + meta + z ')).toBe('alt+meta+z');
    });

    it('returns null for empty values', () => {
      expect(normalizeHotkey('')).toBeNull();
      expect(normalizeHotkey(undefined)).toBeNull();
      expect(normalizeHotkey(null)).toBeNull();
    });
  });

  describe('validateAndNormalizeShortcutActions', () => {
    it('accepts legacy config payload for playSoundEffect', () => {
      const result = validateAndNormalizeShortcutActions([
        {
          kind: 'playSoundEffect',
          config: {
            effectId: 'fx-1',
            volume: 0.8,
            loopMode: 'once',
            uniquePerEffect: true,
          },
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'playSoundEffect',
        payload: {
          effectId: 'fx-1',
          volume: 0.8,
          loopMode: 'once',
          uniquePerEffect: true,
        },
      });
    });

    it('accepts new payload and delay metadata', () => {
      const result = validateAndNormalizeShortcutActions([
        {
          kind: 'delay.wait',
          delayMs: 500,
          payload: { durationMs: 1200 },
        },
      ]);

      expect(result).toEqual([
        {
          kind: 'delay.wait',
          delayMs: 500,
          payload: { durationMs: 1200 },
        },
      ]);
    });

    it('rejects unsupported action kind', () => {
      expect(() =>
        validateAndNormalizeShortcutActions([
          { kind: 'unknown.kind' as any, payload: {} },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid target window shape', () => {
      expect(() =>
        validateAndNormalizeShortcutActions([
          {
            kind: 'window.showText',
            payload: { text: 'hello' },
            targetWindow: { kind: 'instance' },
          },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects missing required payload values', () => {
      expect(() =>
        validateAndNormalizeShortcutActions([
          {
            kind: 'window.setActiveMap',
            payload: {},
          },
        ]),
      ).toThrow(BadRequestException);
    });
  });
});
