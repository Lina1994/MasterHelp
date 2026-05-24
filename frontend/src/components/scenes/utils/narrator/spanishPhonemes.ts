export type PhonemeData = {
  symbol: string;
  kind: 'vowel' | 'consonant' | 'semivowel' | 'nasal' | 'liquid';
  voicing: 'voiced' | 'voiceless';
  formants: {
    F1: number;
    F2: number;
    F3: number;
    B1?: number;
    B2?: number;
    B3?: number;
  };
  duration?: {
    min: number;
    typical: number;
    max: number;
  };
  spectralPeak?: number;
  bandwidth?: number;
};

const SPANISH_PHONEMES: Record<string, PhonemeData> = {
  a: {
    symbol: 'a',
    kind: 'vowel',
    voicing: 'voiced',
    formants: { F1: 730, F2: 1250, F3: 2350, B1: 95, B2: 105, B3: 145 },
    duration: { min: 50, typical: 120, max: 200 },
  },
  e: {
    symbol: 'e',
    kind: 'vowel',
    voicing: 'voiced',
    formants: { F1: 380, F2: 2010, F3: 2530, B1: 75, B2: 106, B3: 140 },
    duration: { min: 50, typical: 120, max: 200 },
  },
  i: {
    symbol: 'i',
    kind: 'vowel',
    voicing: 'voiced',
    formants: { F1: 260, F2: 2180, F3: 2710, B1: 63, B2: 103, B3: 174 },
    duration: { min: 50, typical: 120, max: 200 },
  },
  o: {
    symbol: 'o',
    kind: 'vowel',
    voicing: 'voiced',
    formants: { F1: 455, F2: 810, F3: 2380, B1: 83, B2: 105, B3: 156 },
    duration: { min: 50, typical: 120, max: 200 },
  },
  u: {
    symbol: 'u',
    kind: 'vowel',
    voicing: 'voiced',
    formants: { F1: 300, F2: 690, F3: 2280, B1: 80, B2: 112, B3: 208 },
    duration: { min: 50, typical: 120, max: 200 },
  },
  y: {
    symbol: 'j',
    kind: 'semivowel',
    voicing: 'voiced',
    formants: { F1: 350, F2: 2100, F3: 2800 },
    duration: { min: 30, typical: 60, max: 100 },
  },
  m: {
    symbol: 'm',
    kind: 'nasal',
    voicing: 'voiced',
    formants: { F1: 250, F2: 1200, F3: 1500 },
    duration: { min: 40, typical: 80, max: 150 },
  },
  n: {
    symbol: 'n',
    kind: 'nasal',
    voicing: 'voiced',
    formants: { F1: 350, F2: 1600, F3: 1500 },
    duration: { min: 40, typical: 80, max: 150 },
  },
  ntilde: {
    symbol: 'ɲ',
    kind: 'nasal',
    voicing: 'voiced',
    formants: { F1: 300, F2: 1900, F3: 1500 },
    duration: { min: 40, typical: 80, max: 150 },
  },
  f: {
    symbol: 'f',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 6000,
    bandwidth: 4000,
    duration: { min: 80, typical: 120, max: 180 },
  },
  s: {
    symbol: 's',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 5500,
    bandwidth: 4500,
    duration: { min: 80, typical: 120, max: 180 },
  },
  x: {
    symbol: 'x',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 2500,
    bandwidth: 3000,
    duration: { min: 80, typical: 120, max: 180 },
  },
  p: {
    symbol: 'p',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 2500,
    bandwidth: 3000,
    duration: { min: 60, typical: 100, max: 150 },
  },
  t: {
    symbol: 't',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 4500,
    bandwidth: 2500,
    duration: { min: 60, typical: 100, max: 150 },
  },
  c: {
    symbol: 'k',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 2500,
    bandwidth: 2000,
    duration: { min: 60, typical: 100, max: 150 },
  },
  k: {
    symbol: 'k',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 2500,
    bandwidth: 2000,
    duration: { min: 60, typical: 100, max: 150 },
  },
  q: {
    symbol: 'k',
    kind: 'consonant',
    voicing: 'voiceless',
    formants: { F1: 0, F2: 0, F3: 0 },
    spectralPeak: 2500,
    bandwidth: 2000,
    duration: { min: 60, typical: 100, max: 150 },
  },
  b_ap: {
    symbol: 'β',
    kind: 'consonant',
    voicing: 'voiced',
    formants: { F1: 350, F2: 1200, F3: 2400 },
    duration: { min: 60, typical: 100, max: 150 },
    spectralPeak: 2400,
    bandwidth: 2400,
  },
  d_ap: {
    symbol: 'ð',
    kind: 'consonant',
    voicing: 'voiced',
    formants: { F1: 400, F2: 1800, F3: 2600 },
    duration: { min: 60, typical: 100, max: 150 },
    spectralPeak: 3000,
    bandwidth: 2300,
  },
  g_ap: {
    symbol: 'ɣ',
    kind: 'consonant',
    voicing: 'voiced',
    formants: { F1: 450, F2: 1100, F3: 2400 },
    duration: { min: 60, typical: 100, max: 150 },
    spectralPeak: 2100,
    bandwidth: 2200,
  },
  l: {
    symbol: 'l',
    kind: 'liquid',
    voicing: 'voiced',
    formants: { F1: 350, F2: 1600, F3: 2500 },
    duration: { min: 50, typical: 90, max: 150 },
  },
  r: {
    symbol: 'ɾ',
    kind: 'liquid',
    voicing: 'voiced',
    formants: { F1: 0, F2: 0, F3: 0 },
    duration: { min: 20, typical: 40, max: 70 },
    spectralPeak: 2000,
    bandwidth: 2500,
  },
  rr: {
    symbol: 'r',
    kind: 'liquid',
    voicing: 'voiced',
    formants: { F1: 0, F2: 0, F3: 0 },
    duration: { min: 80, typical: 150, max: 250 },
    spectralPeak: 2000,
    bandwidth: 2500,
  },
};

export const getSpanishPhoneme = (symbol: string): PhonemeData | undefined => SPANISH_PHONEMES[symbol];

export const getSpanishDurationMultiplier = (symbol: string, referenceMs = 90): number => {
  const typical = SPANISH_PHONEMES[symbol]?.duration?.typical;
  if (!typical || referenceMs <= 0) return 1;
  return Math.max(0.65, Math.min(1.7, typical / referenceMs));
};

export default SPANISH_PHONEMES;
