export type TomodachiSampleId = 'a' | 'e' | 'i' | 'o' | 'u' | 'click';
export type TomodachiSampleSet = 'classic' | 'bright' | 'soft';

const VOWEL_SAMPLE_BY_CHAR: Record<string, TomodachiSampleId> = {
  a: 'a',
  e: 'e',
  i: 'i',
  o: 'o',
  u: 'u',
  y: 'i',
  aacute: 'a',
  eacute: 'e',
  iacute: 'i',
  oacute: 'o',
  uacute: 'u',
  udiaeresis: 'u',
};

const CHAR_ALIASES: Record<string, string> = {
  '\u00e1': 'aacute',
  '\u00e9': 'eacute',
  '\u00ed': 'iacute',
  '\u00f3': 'oacute',
  '\u00fa': 'uacute',
  '\u00fc': 'udiaeresis',
};

/**
 * Resolves a text character to a tomodachi sample id.
 */
export function resolveTomodachiSampleId(char: string): TomodachiSampleId {
  const normalizedChar = String(char ?? '').trim().toLowerCase();
  if (!normalizedChar) return 'click';
  const alias = CHAR_ALIASES[normalizedChar] ?? normalizedChar;
  return VOWEL_SAMPLE_BY_CHAR[alias] ?? 'click';
}

/**
 * Returns the public URL path for a tomodachi sample id.
 */
export function resolveTomodachiSamplePath(sampleId: TomodachiSampleId): string {
  return resolveTomodachiSamplePathForSet(sampleId, 'classic');
}

/**
 * Returns the public URL path for a tomodachi sample id and sample set.
 */
export function resolveTomodachiSamplePathForSet(sampleId: TomodachiSampleId, sampleSet: TomodachiSampleSet): string {
  if (sampleSet === 'classic') {
    return `/sounds/tomodachi/${sampleId}.wav`;
  }
  return `/sounds/tomodachi/${sampleSet}/${sampleId}.wav`;
}
