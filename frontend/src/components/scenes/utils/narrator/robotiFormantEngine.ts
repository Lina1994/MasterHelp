import type { NarratorPlaybackHandle, NarratorVoiceConfig } from '../narratorPlayback';

type PlayRobotiNarrationOptions = {
  text: string;
  voiceConfig: NarratorVoiceConfig;
  locale?: string;
};

type RobotiPhonemeProfile = {
  t: 'v' | 'sv' | 'n' | 'l' | 'tap' | 'trill' | 'stop' | 'affricate' | 'fric' | 'fric_soft' | 'sil';
  F1?: number;
  B1?: number;
  F2?: number;
  B2?: number;
  F3?: number;
  B3?: number;
  F4?: number;
  B4?: number;
  dur: number;
  amp?: number;
  closurePct?: number;
  noiseDurPct?: number;
  noiseAmp?: number;
  burst?: number;
  bw?: number;
  intensity?: number;
  voiced?: boolean;
  lpFreq?: number;
  hpFreq?: number;
  resFreq?: number;
  resBw?: number;
  trillHz?: number;
  noiseType?: 'white' | 'pink';
};

type RenderedPhoneme = { ph: string; samples: Float32Array };
type ProsodyToken = {
  ph: string;
  durationMul: number;
  pitchMul: number;
  energyMul: number;
};

type TrajectoryCurve = 'hold' | 'linear' | 'sigmoid';

type TrajectoryKeyframe = {
  timeMs: number;
  value: number;
  curve?: TrajectoryCurve;
};

type ParameterTrajectories = {
  f0: TrajectoryKeyframe[];
  gain: TrajectoryKeyframe[];
  voicingMix: TrajectoryKeyframe[];
  f1: TrajectoryKeyframe[];
  f2: TrajectoryKeyframe[];
  f3: TrajectoryKeyframe[];
  b1: TrajectoryKeyframe[];
  b2: TrajectoryKeyframe[];
  b3: TrajectoryKeyframe[];
  aspirationGain: TrajectoryKeyframe[];
  noiseGain: TrajectoryKeyframe[];
  noiseCenterHz: TrajectoryKeyframe[];
  nasalZeroGain: TrajectoryKeyframe[];
};

type SynthesisTimelineEvent = {
  ph: string;
  profile: RobotiPhonemeProfile;
  startMs: number;
  endMs: number;
  durationMs: number;
  prosody: ProsodyToken;
  prevPh: string;
  nextPh: string;
};

type SynthesisTimeline = {
  events: SynthesisTimelineEvent[];
  totalMs: number;
};

type FrameParameterVector = {
  f0: number;
  gain: number;
  voicingMix: number;
  f1: number;
  f2: number;
  f3: number;
  b1: number;
  b2: number;
  b3: number;
  aspirationGain: number;
  noiseGain: number;
  noiseCenterHz: number;
  nasalZeroGain: number;
};

type ContinuousSourceState = {
  glottalPhase: number;
  aspirationLP: { alpha: number; out: number };
  noiseHP: { alpha: number; out: number };
  noiseLP: { alpha: number; out: number };
  noiseOutHP: { alpha: number; out: number };
};

const SAMPLE_RATE = 44100;
const AUDIO_START_DELAY_MS = 24;
const MAX_CACHE_ENTRIES = 220;
const SYNTH_CACHE_VERSION = 'roboti-2026-05-26-v4';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const normalizeText = (text: string): string => String(text ?? '').replace(/\s+/g, ' ').trim();

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed: number): (() => number) => {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
};

const VOICED_TRANSITION_TYPES = new Set<RobotiPhonemeProfile['t']>(['v', 'sv', 'n', 'l', 'tap', 'trill', 'fric_soft']);
const HARD_TRANSITION_TYPES = new Set<RobotiPhonemeProfile['t']>(['stop', 'affricate']);
const VOWEL_SYMBOLS = new Set(['a', 'e', 'i', 'o', 'u']);
const LENITION_SYMBOLS = new Set(['b', 'd', 'g', 'β', 'ð', 'ɣ']);
const VOICELESS_SYMBOLS = new Set(['p', 't', 'k', 's', 'x', 'f', 'ch', 'θ']);
const STRONG_BREAK_SYMBOLS = new Set(['.', ';', ':', '…', '?', '!']);
const WEAK_BREAK_SYMBOLS = new Set([',']);

const isVowelLikeSymbol = (symbol: string): boolean => {
  const profile = PH[symbol];
  return profile?.t === 'v' || profile?.t === 'sv';
};

const isVoicelessStopSymbol = (symbol: string): boolean => symbol === 'p' || symbol === 't' || symbol === 'k';

type RobotiFormants = {
  F1: number;
  B1: number;
  F2: number;
  B2: number;
  F3: number;
  B3: number;
  F4: number;
  B4: number;
};

const CONSONANT_LOCI: Record<string, { F2: number; F3: number }> = {
  p: { F2: 860, F3: 2200 },
  b: { F2: 920, F3: 2250 },
  'β': { F2: 980, F3: 2350 },
  m: { F2: 920, F3: 2250 },
  f: { F2: 1450, F3: 2550 },
  t: { F2: 1800, F3: 2650 },
  d: { F2: 1820, F3: 2680 },
  'ð': { F2: 1840, F3: 2700 },
  s: { F2: 1980, F3: 3050 },
  'θ': { F2: 1720, F3: 2750 },
  n: { F2: 1650, F3: 2600 },
  l: { F2: 1500, F3: 2550 },
  r: { F2: 1450, F3: 2450 },
  'ɾ': { F2: 1420, F3: 2420 },
  k: { F2: 1320, F3: 2280 },
  g: { F2: 1280, F3: 2240 },
  'ɣ': { F2: 1350, F3: 2320 },
  x: { F2: 1400, F3: 2400 },
  ch: { F2: 1900, F3: 2900 },
  j: { F2: 1950, F3: 2900 },
  w: { F2: 900, F3: 2200 },
};

const NATURAL_BW_DIVISOR = 10;
const BW_SAFETY_MUL = 1.15;
const VOICE_CUT_MS = 1;
const CV_TRANSITION_FAST_MUL = 0.15;
const CONSONANT_NOISE_MUL = 1.4;
const VOWEL_NOISE_MUL = 0.9;

const naturalizeBandwidth = (freq: number, bw: number): number => {
  if (!Number.isFinite(freq) || !Number.isFinite(bw)) return bw;
  return Math.max(bw, freq / NATURAL_BW_DIVISOR);
};

const sigmoid01 = (x: number): number => {
  const k = 10;
  const cx = clamp(x, 0, 1);
  const s0 = 1 / (1 + Math.exp(k * 0.5));
  const s1 = 1 / (1 + Math.exp(-k * 0.5));
  const sv = 1 / (1 + Math.exp(-k * (cx - 0.5)));
  return (sv - s0) / (s1 - s0);
};

const lfLikeGlottalPulse = (phase: number, rd: number): number => {
  const p = phase % 1;
  const rdClamped = clamp(rd, 0.7, 2.7);
  const openQ = clamp(0.52 - ((rdClamped - 0.7) * 0.09), 0.33, 0.58);
  const returnQ = clamp(0.1 + ((rdClamped - 0.7) * 0.08), 0.08, 0.26);
  if (p < openQ) {
    const x = p / openQ;
    return Math.sin(Math.PI * x) * (0.92 + (0.08 * Math.cos(Math.PI * x)));
  }
  if (p < openQ + returnQ) {
    const x = (p - openQ) / returnQ;
    const smooth = x * x * (3 - 2 * x);
    return -0.42 * smooth * (1 - x);
  }
  return 0;
};

const generatePinkNoise = (length: number): Float32Array => {
  const buf = new Float32Array(length);
  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    buf[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  let mx = 0;
  for (let i = 0; i < length; i += 1) mx = Math.max(mx, Math.abs(buf[i]));
  if (mx > 0) for (let i = 0; i < length; i += 1) buf[i] /= mx;
  return buf;
};

const normalizePhoneme = (buf: Float32Array, targetRMS: number): Float32Array => {
  let energy = 0;
  for (let i = 0; i < buf.length; i += 1) energy += buf[i] * buf[i];
  if (energy < 1e-12) return buf;
  const currentRMS = Math.sqrt(energy / buf.length);
  if (currentRMS < 1e-8) return buf;
  const scale = clamp(targetRMS / currentRMS, 0.15, 4);
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] *= scale;
    if (buf[i] > 2) buf[i] = 2;
    if (buf[i] < -2) buf[i] = -2;
  }
  return buf;
};

const normalizeGlobalSignal = (buf: Float32Array, targetPeak: number): Float32Array => {
  let mx = 0;
  for (let i = 0; i < buf.length; i += 1) mx = Math.max(mx, Math.abs(buf[i]));
  if (mx > 0) {
    const sc = targetPeak / mx;
    for (let i = 0; i < buf.length; i += 1) buf[i] *= sc;
  }
  return buf;
};

const makeRes = (freq: number, bw: number): { cr: number; sr2: number; norm: number; re: number; im: number } => {
  const w0 = (Math.PI * 2 * freq) / SAMPLE_RATE;
  const rr = Math.exp((-Math.PI * bw) / SAMPLE_RATE);
  return { cr: rr * Math.cos(w0), sr2: rr * Math.sin(w0), norm: 1 - rr, re: 0, im: 0 };
};

const retuneRes = (res: { cr: number; sr2: number; norm: number; re: number; im: number }, freq: number, bw: number): void => {
  const w0 = (Math.PI * 2 * freq) / SAMPLE_RATE;
  const rr = Math.exp((-Math.PI * bw) / SAMPLE_RATE);
  res.cr = rr * Math.cos(w0);
  res.sr2 = rr * Math.sin(w0);
  res.norm = 1 - rr;
};

const toFormants = (pd: RobotiPhonemeProfile): RobotiFormants => ({
  F1: pd.F1 ?? 450,
  B1: (pd.B1 ?? 70) * BW_SAFETY_MUL,
  F2: pd.F2 ?? 1500,
  B2: (pd.B2 ?? 110) * BW_SAFETY_MUL,
  F3: pd.F3 ?? 2500,
  B3: (pd.B3 ?? 130) * BW_SAFETY_MUL,
  F4: pd.F4 ?? 3500,
  B4: (pd.B4 ?? 210) * BW_SAFETY_MUL,
});

const getCoarticulationFormants = (
  ph: string,
  pd: RobotiPhonemeProfile,
  prevPh: string | undefined,
): { start: RobotiFormants; end: RobotiFormants; transitionSamples: number } => {
  const end = toFormants(pd);
  const prevLocus = prevPh ? CONSONANT_LOCI[prevPh] : undefined;
  const isVowel = pd.t === 'v' || pd.t === 'sv';
  if (!isVowel || !prevLocus) {
    return { start: end, end, transitionSamples: 0 };
  }

  const start: RobotiFormants = {
    F1: Math.max(180, end.F1 * 0.9),
    B1: end.B1,
    F2: prevLocus.F2,
    B2: end.B2,
    F3: prevLocus.F3,
    B3: end.B3,
    F4: end.F4,
    B4: end.B4,
  };
  const transitionSamples = Math.round((clamp(ph === 'i' || ph === 'u' ? 36 : 42, 20, 50) / 1000) * SAMPLE_RATE);
  return { start, end, transitionSamples };
};

const findNearestZeroCrossing = (buf: Float32Array, target: number, radius: number): number => {
  if (!buf.length) return 0;
  const start = Math.max(0, target - radius);
  const end = Math.min(buf.length - 2, target + radius);
  let bestIndex = Math.max(0, Math.min(buf.length - 1, target));
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = start; i <= end; i += 1) {
    const a = buf[i];
    const b = buf[i + 1];
    if (a === 0 || b === 0 || (a < 0 && b > 0) || (a > 0 && b < 0)) {
      const dist = Math.abs(i - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
};

const stepRes = (res: { cr: number; sr2: number; norm: number; re: number; im: number }, input: number): number => {
  const nre = input * res.norm + res.cr * res.re - res.sr2 * res.im;
  const nim = res.sr2 * res.re + res.cr * res.im;
  res.re = nre;
  res.im = nim;
  return res.im;
};

const makeLP = (cutoff: number): { alpha: number; out: number } => {
  let alpha = 2 * Math.sin((Math.PI * cutoff) / SAMPLE_RATE);
  if (alpha > 1) alpha = 1;
  if (alpha < 0.001) alpha = 0.001;
  return { alpha, out: 0 };
};

const stepLP = (lp: { alpha: number; out: number }, input: number): number => {
  lp.out += lp.alpha * (input - lp.out);
  return lp.out;
};

const makeHP = (cutoff: number): { alpha: number; out: number } => {
  let alpha = 2 * Math.sin((Math.PI * cutoff) / SAMPLE_RATE);
  if (alpha > 1) alpha = 1;
  if (alpha < 0.001) alpha = 0.001;
  return { alpha, out: 0 };
};

const stepHP = (hp: { alpha: number; out: number }, input: number): number => {
  hp.out += hp.alpha * (input - hp.out);
  return input - hp.out;
};

const resetGlottal = (): void => {
  gPhase = 0;
};

let gPhase = 0;

const PH: Record<string, RobotiPhonemeProfile> = {
  p: { t: 'stop', burst: 1500, bw: 600, intensity: 0.45, dur: 55, closurePct: 0.5 },
  t: { t: 'stop', burst: 2500, bw: 800, intensity: 0.4, dur: 50, closurePct: 0.5 },
  k: { t: 'stop', burst: 2000, bw: 700, intensity: 0.4, dur: 55, closurePct: 0.5 },
  b: { t: 'fric_soft', lpFreq: 1200, hpFreq: 150, voiced: true, dur: 55, amp: 0.28, noiseType: 'white' },
  d: { t: 'fric_soft', lpFreq: 1800, hpFreq: 250, voiced: true, dur: 65, amp: 0.32, noiseType: 'white' },
  g: { t: 'fric_soft', lpFreq: 1500, hpFreq: 200, voiced: true, dur: 55, amp: 0.28, noiseType: 'white' },
  'β': { t: 'fric_soft', lpFreq: 1200, hpFreq: 150, voiced: true, dur: 55, amp: 0.28, noiseType: 'white' },
  'ð': { t: 'fric_soft', lpFreq: 1800, hpFreq: 250, voiced: true, dur: 65, amp: 0.32, noiseType: 'white' },
  'ɣ': { t: 'fric_soft', lpFreq: 1500, hpFreq: 200, voiced: true, dur: 55, amp: 0.28, noiseType: 'white' },
  f: { t: 'fric', lpFreq: 6000, hpFreq: 1500, resFreq: 4000, resBw: 1200, dur: 75, amp: 0.48, noiseType: 'pink' },
  'θ': { t: 'fric', lpFreq: 5000, hpFreq: 1000, resFreq: 3500, resBw: 1000, dur: 70, amp: 0.45, noiseType: 'pink' },
  s: { t: 'fric', lpFreq: 8000, hpFreq: 2000, resFreq: 5500, resBw: 1500, dur: 90, amp: 0.65, noiseType: 'pink' },
  x: { t: 'fric', lpFreq: 4000, hpFreq: 2000, resFreq: 3200, resBw: 900, dur: 65, amp: 0.48, noiseType: 'white' },
  ch: { t: 'affricate', burst: 3000, bw: 1000, dur: 90, closurePct: 0.35, noiseDurPct: 0.65, noiseAmp: 0.35 },
  m: { t: 'n', F1: 250, B1: 60, F2: 750, B2: 100, F3: 2200, B3: 130, F4: 3000, B4: 200, dur: 75, amp: 0.55 },
  n: { t: 'n', F1: 280, B1: 65, F2: 1500, B2: 110, F3: 2500, B3: 130, F4: 3300, B4: 200, dur: 75, amp: 0.55 },
  'ɲ': { t: 'n', F1: 330, B1: 70, F2: 1700, B2: 115, F3: 2700, B3: 130, F4: 3500, B4: 200, dur: 75, amp: 0.55 },
  l: { t: 'l', F1: 380, B1: 70, F2: 1250, B2: 100, F3: 2600, B3: 130, F4: 3500, B4: 200, dur: 55, amp: 0.48 },
  'ʎ': { t: 'l', F1: 380, B1: 70, F2: 1750, B2: 115, F3: 2700, B3: 130, F4: 3600, B4: 200, dur: 55, amp: 0.48 },
  'ɾ': { t: 'tap', F1: 350, B1: 70, F2: 1300, B2: 100, F3: 2500, B3: 130, F4: 3400, B4: 200, dur: 30, amp: 0.22 },
  r: { t: 'trill', F1: 350, B1: 70, F2: 1300, B2: 100, F3: 2500, B3: 130, F4: 3400, B4: 200, dur: 80, trillHz: 28, amp: 0.32 },
  j: { t: 'sv', F1: 230, B1: 45, F2: 1700, B2: 100, F3: 2550, B3: 130, F4: 3600, B4: 200, dur: 40, amp: 0.45 },
  w: { t: 'sv', F1: 240, B1: 40, F2: 720, B2: 65, F3: 2200, B3: 120, F4: 3400, B4: 200, dur: 40, amp: 0.45 },
  a: { t: 'v', F1: 730, B1: 60, F2: 1150, B2: 80, F3: 2440, B3: 120, F4: 3600, B4: 200, dur: 100, amp: 0.95 },
  e: { t: 'v', F1: 500, B1: 50, F2: 1900, B2: 80, F3: 2500, B3: 120, F4: 3600, B4: 200, dur: 85, amp: 0.76 },
  i: { t: 'v', F1: 300, B1: 45, F2: 2250, B2: 100, F3: 3000, B3: 140, F4: 3800, B4: 200, dur: 80, amp: 0.66 },
  o: { t: 'v', F1: 550, B1: 50, F2: 870, B2: 65, F3: 2420, B3: 120, F4: 3600, B4: 200, dur: 95, amp: 0.76 },
  u: { t: 'v', F1: 300, B1: 40, F2: 680, B2: 70, F3: 2250, B3: 120, F4: 3600, B4: 200, dur: 80, amp: 0.66 },
  ' ': { t: 'sil', dur: 70, amp: 0 },
  '.': { t: 'sil', dur: 300, amp: 0 },
  '?': { t: 'sil', dur: 320, amp: 0 },
  '!': { t: 'sil', dur: 280, amp: 0 },
  ',': { t: 'sil', dur: 180, amp: 0 },
  ':': { t: 'sil', dur: 240, amp: 0 },
  ';': { t: 'sil', dur: 240, amp: 0 },
  '…': { t: 'sil', dur: 420, amp: 0 },
};

const isSilenceSymbol = (symbol: string): boolean => {
  const profile = PH[symbol];
  return profile?.t === 'sil';
};

const resolveSilenceDurationMs = (symbol: string, voiceConfig: NarratorVoiceConfig): number => {
  const punctuationBase = clamp(voiceConfig.roboti.punctuationPauseMs, 80, 700);
  const spaceBase = clamp(voiceConfig.roboti.spacePauseMs, 20, 300);
  if (symbol === ' ') return spaceBase;
  if (symbol === ',') return (punctuationBase * 0.6) + 14;
  if (symbol === ':' || symbol === ';') return (punctuationBase * 0.78) + 16;
  if (symbol === '…') return (punctuationBase * 1.4) + 18;
  if (symbol === '?') return Math.max(360, punctuationBase + 30);
  if (symbol === '!') return Math.max(320, punctuationBase + 24);
  // Punto y seguido: silencio real mínimo para procesar frase.
  if (symbol === '.') return Math.max(400, punctuationBase + 18);
  return (PH[symbol] ?? PH[' ']).dur;
};

const buildBreathSilence = (length: number, noiseAmount: number): Float32Array => {
  const buf = new Float32Array(length);
  const floorAmp = 0.00045 + (noiseAmount * 0.00085);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const slowPulse = 0.85 + 0.15 * Math.sin((Math.PI * 2 * 1.7) * t);
    const env = i < length * 0.08
      ? i / Math.max(1, length * 0.08)
      : i > length * 0.92
        ? (length - i) / Math.max(1, length * 0.08)
        : 1;
    buf[i] = (Math.random() * 2 - 1) * floorAmp * slowPulse * Math.max(0, env);
  }
  return buf;
};

const isPauseSymbol = (symbol: string): boolean => STRONG_BREAK_SYMBOLS.has(symbol) || WEAK_BREAK_SYMBOLS.has(symbol) || symbol === ' ';

const buildProsodyTokens = (text: string): ProsodyToken[] => {
  const symbols = charToPhonemes(text);
  const tokens: ProsodyToken[] = symbols.map((ph) => ({
    ph,
    durationMul: 1,
    pitchMul: 1,
    energyMul: 1,
  }));
  const stressedVowelIndices = new Set<number>();

  // Word-level stress heuristic and micro variation.
  let cursor = 0;
  while (cursor < tokens.length) {
    while (cursor < tokens.length && isPauseSymbol(tokens[cursor].ph)) cursor += 1;
    if (cursor >= tokens.length) break;
    const wordStart = cursor;
    while (cursor < tokens.length && !isPauseSymbol(tokens[cursor].ph)) cursor += 1;
    const wordEnd = cursor;
    const vowelIndices: number[] = [];
    for (let i = wordStart; i < wordEnd; i += 1) {
      if (VOWEL_SYMBOLS.has(tokens[i].ph)) {
        vowelIndices.push(i);
      }
    }
    if (vowelIndices.length > 0) {
      const lastVowel = vowelIndices[vowelIndices.length - 1];
      const penultimateVowel = vowelIndices.length > 1 ? vowelIndices[vowelIndices.length - 2] : lastVowel;
      const finalSymbol = tokens[wordEnd - 1]?.ph ?? '';
      const stressIndex = (VOWEL_SYMBOLS.has(finalSymbol) || finalSymbol === 'n' || finalSymbol === 's')
        ? penultimateVowel
        : lastVowel;

      // Duración tónica/átona se aplica más abajo en un bloque dedicado.
      tokens[stressIndex].pitchMul *= 1.1;
      tokens[stressIndex].energyMul *= 1.09;
      stressedVowelIndices.add(stressIndex);
      if (stressIndex - 1 >= wordStart) {
        tokens[stressIndex - 1].pitchMul *= 1.03;
      }
    }

    const wordSeed = seededRandom(hashString(`${text}|${wordStart}|${wordEnd}`));
    const wordPitchOffset = (wordSeed() - 0.5) * 0.05;
    for (let i = wordStart; i < wordEnd; i += 1) {
      tokens[i].pitchMul *= 1 + wordPitchOffset;
      tokens[i].durationMul *= 0.98 + (wordSeed() * 0.05);
    }
  }

  // M1.2b rhythm: tonic syllables +15%, atonic vowels -10%.
  for (let i = 0; i < tokens.length; i += 1) {
    const symbol = tokens[i].ph;
    if (!VOWEL_SYMBOLS.has(symbol)) continue;
    tokens[i].durationMul *= stressedVowelIndices.has(i) ? 1.15 : 0.9;
  }

  // Phrase-level declination and punctuation timing emphasis.
  let phraseStart = 0;
  for (let i = 0; i <= tokens.length; i += 1) {
    const ph = i < tokens.length ? tokens[i].ph : '.';
    if (!STRONG_BREAK_SYMBOLS.has(ph) && i < tokens.length) continue;
    const voicedIndices: number[] = [];
    for (let j = phraseStart; j < i; j += 1) {
      const sym = tokens[j].ph;
      if (!isPauseSymbol(sym)) voicedIndices.push(j);
    }
    for (let idx = 0; idx < voicedIndices.length; idx += 1) {
      const tokenIndex = voicedIndices[idx];
      const progress = voicedIndices.length > 1 ? idx / (voicedIndices.length - 1) : 1;
      const declination = 1.11 - (0.2 * progress);
      const contour = 1 + (0.022 * Math.sin(progress * Math.PI));
      tokens[tokenIndex].pitchMul *= declination * contour;
      if (VOWEL_SYMBOLS.has(tokens[tokenIndex].ph)) {
        tokens[tokenIndex].pitchMul *= 1.015;
      }
      if (progress > 0.85) {
        tokens[tokenIndex].durationMul *= 1.06;
      }
    }
    phraseStart = i + 1;
  }

  // Punctuation cadence: comma anticipation and terminal cadence fall.
  for (let i = 0; i < tokens.length; i += 1) {
    const symbol = tokens[i].ph;
    if (symbol === ',') {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (VOWEL_SYMBOLS.has(tokens[j].ph)) {
          tokens[j].pitchMul *= 1.05;
          break;
        }
      }
      continue;
    }
    if (symbol === '.') {
      const lastTwoVowels: number[] = [];
      for (let j = i - 1; j >= 0; j -= 1) {
        if (VOWEL_SYMBOLS.has(tokens[j].ph)) {
          lastTwoVowels.unshift(j);
          if (lastTwoVowels.length === 2) break;
        }
      }
      if (lastTwoVowels.length === 1) {
        const idx = lastTwoVowels[0];
        tokens[idx].pitchMul *= 0.85;
        tokens[idx].energyMul *= 0.78;
      }
      if (lastTwoVowels.length === 2) {
        const first = lastTwoVowels[0];
        const second = lastTwoVowels[1];
        tokens[first].pitchMul *= 0.93;
        tokens[first].energyMul *= 0.9;
        tokens[second].pitchMul *= 0.85;
        tokens[second].energyMul *= 0.78;
      }
    }

    if (symbol === '?') {
      // Rising contour at the end of the questioned phrase.
      const lastVowels: number[] = [];
      for (let j = i - 1; j >= 0; j -= 1) {
        if (isPauseSymbol(tokens[j].ph)) break;
        if (VOWEL_SYMBOLS.has(tokens[j].ph)) {
          lastVowels.unshift(j);
          if (lastVowels.length === 2) break;
        }
      }
      for (let k = 0; k < lastVowels.length; k += 1) {
        const idx = lastVowels[k];
        const lift = k === lastVowels.length - 1 ? 1.2 : 1.12;
        tokens[idx].pitchMul *= lift;
      }
    }

    if (symbol === '!') {
      // Exclamation: boost pitch and energy for the whole phrase.
      let phraseStart = i - 1;
      while (phraseStart >= 0 && !isPauseSymbol(tokens[phraseStart].ph)) phraseStart -= 1;
      for (let j = phraseStart + 1; j < i; j += 1) {
        tokens[j].pitchMul *= 1.15;
        tokens[j].energyMul *= 1.15;
      }
    }
  }

  // Clamp final modulation values.
  for (const token of tokens) {
    token.durationMul = clamp(token.durationMul, 0.72, 1.5);
    token.pitchMul = clamp(token.pitchMul, 0.72, 1.28);
    token.energyMul = clamp(token.energyMul, 0.8, 1.22);
    if (isPauseSymbol(token.ph)) {
      token.pitchMul = 1;
      token.energyMul = 1;
      token.durationMul = 1;
    }
  }

  return tokens;
};

const isStrongContext = (currentIdx: number, prevChar: string): boolean => {
  if (currentIdx === 0) return true;
  if (prevChar === 'm' || prevChar === 'n' || prevChar === 'ɲ') return true;
  if (prevChar === ' ' || prevChar === '.' || prevChar === ',') return true;
  return false;
};

const charToPhonemes = (text: string): string[] => {
  const t = text.toLowerCase();
  const out: string[] = [];
  let ii = 0;

  while (ii < t.length) {
    const c = t[ii];
    const n = t[ii + 1] ?? '';
    const p = ii > 0 ? t[ii - 1] : '';

    if (c === ' ') { out.push(' '); ii += 1; continue; }
    if (c === '…') { out.push('…'); ii += 1; continue; }
    if (c === '.' && n === '.' && (t[ii + 2] ?? '') === '.') { out.push('…'); ii += 3; continue; }
    if (c === ',') { out.push(','); ii += 1; continue; }
    if (c === ':') { out.push(':'); ii += 1; continue; }
    if (c === ';') { out.push(';'); ii += 1; continue; }
    if (c === '.') { out.push('.'); ii += 1; continue; }
    if (c === '?') { out.push('?'); ii += 1; continue; }
    if (c === '!') { out.push('!'); ii += 1; continue; }
    if (c === 'l' && n === 'l') { out.push('ʎ'); ii += 2; continue; }
    if (c === 'c' && n === 'h') { out.push('ch'); ii += 2; continue; }
    if (c === 'r' && n === 'r') { out.push('r'); ii += 2; continue; }
    if (c === 'q' && n === 'u') { out.push('k'); out.push('w'); ii += 2; continue; }
    if (c === 'g' && n === 'u' && (t[ii + 2] === 'e' || t[ii + 2] === 'i')) { out.push('g'); ii += 3; continue; }
    if (c === 'h') { ii += 1; continue; }

    const vowels = 'aeiouáéíóúü';
    if (vowels.indexOf(c) !== -1) {
      const v = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (v === 'i' && 'aeou'.indexOf(n) !== -1) { out.push('j'); ii += 1; continue; }
      if (v === 'u' && 'aeo'.indexOf(n) !== -1) { out.push('w'); ii += 1; continue; }
      if ('aeo'.indexOf(v) !== -1 && n === 'i') { out.push(v, 'j'); ii += 2; continue; }
      if ('aeo'.indexOf(v) !== -1 && n === 'u') { out.push(v, 'w'); ii += 2; continue; }
      out.push(v);
      ii += 1;
      continue;
    }

    if (c === 'b' || c === 'v') { out.push(isStrongContext(ii, p) ? 'b' : 'β'); ii += 1; continue; }
    if (c === 'd') { out.push(isStrongContext(ii, p) ? 'd' : 'ð'); ii += 1; continue; }
    if (c === 'g') { out.push(isStrongContext(ii, p) ? 'g' : 'ɣ'); ii += 1; continue; }
    if (c === 'y') {
      const prevV = vowels.indexOf(p) !== -1;
      const nextV = vowels.indexOf(n) !== -1;
      out.push(prevV && nextV ? 'ɣ' : 'j');
      ii += 1;
      continue;
    }

    if (c === 'c') { out.push(n === 'e' || n === 'i' ? 'θ' : 'k'); ii += 1; continue; }
    if (c === 'z') { out.push('θ'); ii += 1; continue; }
    if (c === 'n' && n === 'y') { out.push('ɲ'); ii += 2; continue; }
    if (c === 'j') { out.push('x'); ii += 1; continue; }
    if ('ptfkmnslr'.indexOf(c) !== -1) { out.push(c); ii += 1; continue; }
    if (c === 'ñ') { out.push('ɲ'); ii += 1; continue; }

    ii += 1;
  }

  return out;
};

const makeF0 = (voiceConfig: NarratorVoiceConfig): number => {
  const base = voiceConfig.roboti.voice === 'male' ? 115 : voiceConfig.roboti.voice === 'female' ? 185 : 150;
  return base * Math.pow(2, clamp(voiceConfig.roboti.pitchSemitones, -12, 12) / 12);
};

const addKeyframe = (target: TrajectoryKeyframe[], timeMs: number, value: number, curve: TrajectoryCurve = 'linear'): void => {
  target.push({ timeMs, value, curve });
};

const ensureTrajectoryFloor = (arr: TrajectoryKeyframe[]): TrajectoryKeyframe[] => {
  if (!arr.length) return [{ timeMs: 0, value: 0, curve: 'hold' }];
  const sorted = [...arr].sort((a, b) => a.timeMs - b.timeMs);
  if (sorted[0].timeMs > 0) {
    sorted.unshift({ timeMs: 0, value: sorted[0].value, curve: 'hold' });
  }
  return sorted;
};

const sampleTrajectoryAtTime = (arr: TrajectoryKeyframe[], timeMs: number): number => {
  if (!arr.length) return 0;
  if (timeMs <= arr[0].timeMs) return arr[0].value;
  for (let i = 0; i < arr.length - 1; i += 1) {
    const a = arr[i];
    const b = arr[i + 1];
    if (timeMs < b.timeMs) {
      if (a.curve === 'hold' || b.timeMs <= a.timeMs + 1e-6) return a.value;
      const t = clamp((timeMs - a.timeMs) / (b.timeMs - a.timeMs), 0, 1);
      const shaped = a.curve === 'sigmoid' ? sigmoid01(t) : t;
      return a.value + ((b.value - a.value) * shaped);
    }
  }
  return arr[arr.length - 1].value;
};

const buildSynthesisTimeline = (text: string, voiceConfig: NarratorVoiceConfig, tokens: ProsodyToken[]): SynthesisTimeline => {
  const events: SynthesisTimelineEvent[] = [];
  let cursorMs = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const profile = PH[token.ph] ?? PH[' '];
    // M1.3: slow down global prosody by 10% to prioritize clarity.
    const speed = clamp(voiceConfig.speed * 0.9, 0.18, 1.8);
    const baseMs = profile.t === 'sil'
      ? resolveSilenceDurationMs(token.ph, voiceConfig)
      : ((profile.t === 'v' ? profile.dur * 1.25 : profile.t === 'sv' ? profile.dur * 0.95 : profile.dur) / speed) * clamp(token.durationMul, 0.72, 1.5);
    // Phoneme duration floor to keep ultra-short segments audible without
    // making taps/semivowels unnaturally long.
    const durationMs = profile.t === 'sil' ? Math.max(8, baseMs) : Math.max(35, baseMs);
    const startMs = cursorMs;
    const endMs = startMs + durationMs;
    events.push({
      ph: token.ph,
      profile,
      startMs,
      endMs,
      durationMs,
      prosody: token,
      prevPh: i > 0 ? tokens[i - 1].ph : '',
      nextPh: i + 1 < tokens.length ? tokens[i + 1].ph : '',
    });
    cursorMs = endMs;
  }
  return { events, totalMs: cursorMs };
};

const buildParameterTrajectories = (
  timeline: SynthesisTimeline,
  voiceConfig: NarratorVoiceConfig,
  baseF0: number,
): ParameterTrajectories => {
  const f0: TrajectoryKeyframe[] = [];
  const gain: TrajectoryKeyframe[] = [];
  const voicingMix: TrajectoryKeyframe[] = [];
  const f1: TrajectoryKeyframe[] = [];
  const f2: TrajectoryKeyframe[] = [];
  const f3: TrajectoryKeyframe[] = [];
  const b1: TrajectoryKeyframe[] = [];
  const b2: TrajectoryKeyframe[] = [];
  const b3: TrajectoryKeyframe[] = [];
  const aspirationGain: TrajectoryKeyframe[] = [];
  const noiseGain: TrajectoryKeyframe[] = [];
  const noiseCenterHz: TrajectoryKeyframe[] = [];
  const nasalZeroGain: TrajectoryKeyframe[] = [];

  // Derive per-utterance aspiration/noise floors from voice config.
  const aspBase = clamp(voiceConfig.roboti.aspiration, 0, 0.8) * 0.025;
  const nzBase = clamp(voiceConfig.roboti.noiseAmount, 0, 0.8) * 0.015;

  // Track formant end-values per phoneme so the next phoneme can start
  // from the previous one's acoustic state, avoiding instantaneous jumps.
  let lastF1: number | null = null;
  let lastF2: number | null = null;
  let lastF3: number | null = null;

  for (const event of timeline.events) {
    const { profile, startMs, endMs, durationMs, prosody } = event;
    const start = startMs;
    const end = endMs;
    const cutMs = VOICE_CUT_MS;
    const cutStart = Math.max(0, start - cutMs);
    const cutEnd = Math.min(end, start + cutMs);
    const pitch = baseF0 * clamp(prosody.pitchMul, 0.72, 1.28);
    const isVowelCore = profile.t === 'v' || profile.t === 'sv';
    const isConsonantCore = !isVowelCore && profile.t !== 'sil';
    const isVoiceless = VOICELESS_SYMBOLS.has(event.ph);
    const isConsonantToVowel = isConsonantCore && isVowelLikeSymbol(event.nextPh);
    // M1.3: consonants +20% level vs vowels to improve intelligibility.
    const contrastMul = isConsonantCore ? 1.5 : 1;
    const level = (profile.amp ?? 0.5) * clamp(prosody.energyMul, 0.75, 1.25) * contrastMul;

    if (profile.t === 'sil') {
      // Silence: everything held at zero — no interpolation bleed.
      addKeyframe(f0, start, pitch, 'hold');
      addKeyframe(f0, end, pitch, 'hold');
      addKeyframe(gain, start, 0, 'hold');
      addKeyframe(gain, end, 0, 'hold');
      addKeyframe(voicingMix, start, 0, 'hold');
      addKeyframe(voicingMix, end, 0, 'hold');
      addKeyframe(f1, start, 500, 'hold');
      addKeyframe(f2, start, 1500, 'hold');
      addKeyframe(f3, start, 2500, 'hold');
      addKeyframe(b1, start, 80, 'hold');
      addKeyframe(b2, start, 110, 'hold');
      addKeyframe(b3, start, 130, 'hold');
      addKeyframe(aspirationGain, start, 0, 'hold');
      addKeyframe(aspirationGain, end, 0, 'hold');
      addKeyframe(noiseGain, start, 0, 'hold');
      addKeyframe(noiseGain, end, 0, 'hold');
      addKeyframe(noiseCenterHz, start, 3200, 'hold');
      addKeyframe(noiseCenterHz, end, 3200, 'hold');
      addKeyframe(nasalZeroGain, start, 0, 'hold');
      addKeyframe(nasalZeroGain, end, 0, 'hold');

      // Reset formant tracking through silence.
      lastF1 = null;
      lastF2 = null;
      lastF3 = null;

    } else if (profile.t === 'stop') {
      // Oclusivas (P/T/K): closure phase silent, burst jumps immediately with 'hold'
      // so that interpolación lineal no diluye el transitorio.
      const closurePct = profile.closurePct ?? 0.5;
      const closureEndMs = start + durationMs * closurePct;
      const burstFreq = profile.burst ?? 2000;
      const burstBw = (profile.bw ?? 700) * BW_SAFETY_MUL;
      const intensity = profile.intensity ?? 0.4;
      const stopLocus = CONSONANT_LOCI[event.ph] ?? { F2: burstFreq * 1.4, F3: burstFreq * 1.9 };
      const stopOnsetMs = Math.min(18, durationMs * 0.26) * CV_TRANSITION_FAST_MUL;
      const stopOnsetEnd = Math.min(end, start + stopOnsetMs);
      const nextProfile = PH[event.nextPh];
      const nextIsVowel = nextProfile?.t === 'v' || nextProfile?.t === 'sv';
      const releaseMs = Math.min(12, durationMs * 0.18) * CV_TRANSITION_FAST_MUL;
      const preRelease = Math.max(start, end - releaseMs);
      const nextFormants = nextProfile ? toFormants(nextProfile) : null;

      addKeyframe(f0, start, pitch, 'hold');
      addKeyframe(f0, end, pitch, 'hold');

      // Stops sordos: sin voicing, burst puramente de ruido.
      addKeyframe(gain, cutStart, 0, 'hold');
      addKeyframe(gain, start, 0, 'hold');
      addKeyframe(gain, closureEndMs - 0.01, 0, 'hold');
      addKeyframe(gain, closureEndMs, 0, 'hold');
      addKeyframe(gain, cutEnd, 0, 'hold');
      addKeyframe(gain, end, 0, 'hold');
      addKeyframe(voicingMix, cutStart, 0, 'hold');
      addKeyframe(voicingMix, start, 0, 'hold');
      addKeyframe(voicingMix, end, 0, 'hold');

      // Formantes: apuntados al centro del burst (para filtrado de la explosión).
      // M1.3: aggressive consonant locus at onset for clearer articulation.
      addKeyframe(f1, start, Math.max(250, burstFreq * 0.26), 'hold');
      addKeyframe(f2, start, stopLocus.F2, 'hold');
      addKeyframe(f3, start, stopLocus.F3, 'hold');
      addKeyframe(f1, stopOnsetEnd, Math.max(250, burstFreq * 0.26), 'linear');
      addKeyframe(f2, stopOnsetEnd, stopLocus.F2, 'linear');
      addKeyframe(f3, stopOnsetEnd, stopLocus.F3, 'linear');
      if (nextIsVowel && nextFormants) {
        addKeyframe(f1, preRelease, nextFormants.F1, 'linear');
        addKeyframe(f2, preRelease, nextFormants.F2, 'linear');
        addKeyframe(f3, preRelease, nextFormants.F3, 'linear');
      }
      addKeyframe(f1, end, nextIsVowel && nextFormants ? nextFormants.F1 : Math.max(250, burstFreq * 0.26), 'linear');
      addKeyframe(f2, end, nextIsVowel && nextFormants ? nextFormants.F2 : stopLocus.F2, 'linear');
      addKeyframe(f3, end, nextIsVowel && nextFormants ? nextFormants.F3 : stopLocus.F3, 'linear');
      addKeyframe(b1, start, burstBw, 'hold');
      addKeyframe(b2, start, burstBw * 1.2, 'hold');
      addKeyframe(b3, start, burstBw * 1.4, 'hold');

      // Burst corto e intenso (5-10ms) para P/T/K.
      const burstPulseMs = clamp(7, 5, 10);
      const burstPulseEnd = Math.min(end, closureEndMs + burstPulseMs);
      addKeyframe(noiseGain, start, 0, 'hold');
      addKeyframe(noiseGain, closureEndMs - 0.01, 0, 'hold');
      addKeyframe(noiseGain, closureEndMs, intensity * 2.2 * CONSONANT_NOISE_MUL, 'hold');
      addKeyframe(noiseGain, burstPulseEnd, intensity * 1.7 * CONSONANT_NOISE_MUL, 'hold');
      addKeyframe(noiseGain, end, 0, 'linear');

      // Aspiration VOT durante el burst.
      addKeyframe(aspirationGain, start, 0, 'hold');
      addKeyframe(aspirationGain, closureEndMs, aspBase * 1.8, 'hold');
      addKeyframe(aspirationGain, end, 0, 'linear');
      addKeyframe(noiseCenterHz, start, burstFreq, 'hold');
      addKeyframe(noiseCenterHz, end, burstFreq, 'hold');
      addKeyframe(nasalZeroGain, start, 0, 'hold');
      addKeyframe(nasalZeroGain, end, 0, 'hold');

      // Next phoneme transitions from the stop's release formants.
      lastF1 = nextIsVowel && nextFormants ? nextFormants.F1 : Math.max(250, burstFreq * 0.26);
      lastF2 = nextIsVowel && nextFormants ? nextFormants.F2 : stopLocus.F2;
      lastF3 = nextIsVowel && nextFormants ? nextFormants.F3 : stopLocus.F3;

    } else if (profile.t === 'trill') {
      // RR: modulación de amplitud a 28Hz baked directamente como keyframes en gain.
      const formants = toFormants(profile);
      const trRand = seededRandom(hashString(`trill|${start.toFixed(3)}|${end.toFixed(3)}|${event.ph}`));

      addKeyframe(f0, start, pitch, 'linear');
      addKeyframe(f0, end, pitch, 'linear');
      addKeyframe(f1, start, formants.F1, 'linear');
      addKeyframe(f1, end, formants.F1, 'linear');
      addKeyframe(f2, start, formants.F2, 'linear');
      addKeyframe(f2, end, formants.F2, 'linear');
      addKeyframe(f3, start, formants.F3, 'linear');
      addKeyframe(f3, end, formants.F3, 'linear');
      addKeyframe(b1, start, formants.B1, 'linear');
      addKeyframe(b1, end, formants.B1, 'linear');
      addKeyframe(b2, start, formants.B2, 'linear');
      addKeyframe(b2, end, formants.B2, 'linear');
      addKeyframe(b3, start, formants.B3, 'linear');
      addKeyframe(b3, end, formants.B3, 'linear');

      // Bake AM pattern: on = full gain, off = voiced leakage (~35%).
      let t = start;
      while (t < end) {
        const trHzVar = 25 + (trRand() * 7);
        const trPeriodMs = 1000 / trHzVar;
        const dutyMs = trPeriodMs * 0.5;
        const edgeMs = trPeriodMs * 0.06;
        const onEnd = Math.min(t + dutyMs, end);
        const offEnd = Math.min(t + trPeriodMs, end);
        addKeyframe(gain, t, level, 'hold');
        if (onEnd < end) {
          addKeyframe(gain, onEnd - edgeMs, level, 'linear');
          addKeyframe(gain, onEnd, level * 0.35, 'linear');
          if (offEnd < end) {
            addKeyframe(gain, offEnd - edgeMs, level * 0.35, 'linear');
          }
        }
        t = offEnd;
      }
      addKeyframe(gain, end, level * 0.35, 'hold');
      addKeyframe(voicingMix, start, 1, 'linear');
      addKeyframe(voicingMix, end, 1, 'linear');

      addKeyframe(aspirationGain, start, aspBase * 0.7, 'linear');
      addKeyframe(aspirationGain, end, aspBase * 0.7, 'linear');
      addKeyframe(noiseGain, start, nzBase * 0.5, 'linear');
      addKeyframe(noiseGain, end, nzBase * 0.5, 'linear');
      addKeyframe(noiseCenterHz, start, 3000, 'linear');
      addKeyframe(noiseCenterHz, end, 3000, 'linear');
      addKeyframe(nasalZeroGain, start, 0, 'linear');
      addKeyframe(nasalZeroGain, end, 0, 'linear');

      // Track trill formants for cross-phoneme smoothing.
      lastF1 = formants.F1;
      lastF2 = formants.F2;
      lastF3 = formants.F3;

    } else {
      // voiced / sv / nasal / liquid / fricative / affricate
      const formants = toFormants(profile);
      const curve: TrajectoryCurve = 'sigmoid';
      const mid = start + durationMs * 0.5;
      const isFric = profile.t === 'fric' || profile.t === 'fric_soft';
      const isNasal = profile.t === 'n';
      const isIntervocalicLenition = LENITION_SYMBOLS.has(event.ph)
        && isVowelLikeSymbol(event.prevPh)
        && isVowelLikeSymbol(event.nextPh);
      const isVelarJ = event.ph === 'x';
      const lenitionGainMul = isIntervocalicLenition ? 0.72 : 1;
      const lenitionBwMul = isIntervocalicLenition ? 1.55 : 1;
      const isVoicedStopLike = LENITION_SYMBOLS.has(event.ph);
      const consonantLocus = CONSONANT_LOCI[event.ph] ?? null;
      const onsetMs = Math.min(16, durationMs * 0.22) * (isConsonantToVowel ? CV_TRANSITION_FAST_MUL : 1);
      const onsetEnd = Math.min(end, start + onsetMs);
      const vowelF1 = event.ph === 'i' ? 300 : event.ph === 'u' ? 300 : formants.F1;
      const vowelF2 = event.ph === 'i' ? 2250 : event.ph === 'u' ? 680 : formants.F2;

      addKeyframe(f0, start, pitch, curve);
      addKeyframe(f0, end, pitch, curve);

      // B/D/G intervocálicas: más suaves y con espectro más ancho (lenición).
      // Fonemas sordos: voicing casi nulo para evitar confusión perceptual.
      const baseGainStart = level * 0.85 * lenitionGainMul;
      const baseGainMid = level * lenitionGainMul;
      const baseGainEnd = level * 0.9 * lenitionGainMul;
      if (isVoiceless) {
        // Absolute mute for voiceless phonemes across the full segment.
        // Edge transition to zero is constrained by cutMs (<= 2ms requested).
        addKeyframe(gain, cutStart, 0, 'hold');
        addKeyframe(gain, start, 0, 'hold');
        addKeyframe(gain, mid, 0, 'hold');
        addKeyframe(gain, end, 0, 'hold');
        addKeyframe(voicingMix, cutStart, 0, 'hold');
        addKeyframe(voicingMix, start, 0, 'hold');
        addKeyframe(voicingMix, mid, 0, 'hold');
        addKeyframe(voicingMix, end, 0, 'hold');
      } else {
        addKeyframe(gain, start, baseGainStart, curve);
        addKeyframe(gain, mid, baseGainMid, curve);
        addKeyframe(gain, end, baseGainEnd, curve);
        addKeyframe(voicingMix, start, profile.t === 'fric_soft' ? 0.78 : 1, curve);
        addKeyframe(voicingMix, mid, profile.t === 'fric_soft' ? 0.82 : 1, curve);
        addKeyframe(voicingMix, end, profile.t === 'fric_soft' ? 0.8 : 1, curve);
      }

      // M1.3: faster onset transition for consonant definition (B/D/G emphasis).
      if (isVoicedStopLike && consonantLocus) {
        addKeyframe(f1, start, Math.max(260, formants.F1 * 0.82), 'hold');
        addKeyframe(f2, start, consonantLocus.F2, 'hold');
        addKeyframe(f3, start, consonantLocus.F3, 'hold');
        addKeyframe(f1, onsetEnd, vowelF1, 'linear');
        addKeyframe(f2, onsetEnd, event.ph === 'ɲ' ? 2200 : vowelF2, 'linear');
        addKeyframe(f3, onsetEnd, formants.F3, 'linear');
      } else if (lastF1 !== null && isVowelCore) {
        // Vowel following a consonant/nasal/liquid: smooth transition from
        // the previous phoneme's formants at the boundary instead of jumping.
        const formantRampMs = clamp(durationMs * 0.42, 28, 56);
        const formantRampEnd = Math.min(end, start + formantRampMs);
        addKeyframe(f1, start, lastF1, 'hold');
        addKeyframe(f2, start, lastF2!, 'hold');
        addKeyframe(f3, start, lastF3!, 'hold');
        addKeyframe(f1, formantRampEnd, vowelF1, 'sigmoid');
        addKeyframe(f2, formantRampEnd, event.ph === 'ɲ' ? 2200 : vowelF2, 'sigmoid');
        addKeyframe(f3, formantRampEnd, formants.F3, 'sigmoid');
      } else {
        addKeyframe(f1, start, vowelF1, curve);
        addKeyframe(f2, start, event.ph === 'ɲ' ? 2200 : vowelF2, curve);
        addKeyframe(f3, start, formants.F3, curve);
      }
      addKeyframe(f1, end, vowelF1, curve);
      addKeyframe(f2, end, event.ph === 'ɲ' ? 2200 : vowelF2, curve);
      addKeyframe(f3, end, formants.F3, curve);
      addKeyframe(b1, start, formants.B1 * lenitionBwMul, curve);
      addKeyframe(b1, end, formants.B1 * lenitionBwMul, curve);
      addKeyframe(b2, start, formants.B2 * lenitionBwMul, curve);
      addKeyframe(b2, end, formants.B2 * lenitionBwMul, curve);
      addKeyframe(b3, start, formants.B3 * lenitionBwMul, curve);
      addKeyframe(b3, end, formants.B3 * lenitionBwMul, curve);

      // Fricativas reciben más ruido; las sonoras suaves, aspiración mínima.
      const localAspGain = isFric && profile.t === 'fric_soft'
        ? aspBase * 0.55
        : isFric
          ? aspBase * 3
          : aspBase * (isIntervocalicLenition ? 0.7 : 1);
      const localNzGain = isFric
        ? nzBase * 8 + (clamp(voiceConfig.roboti.noiseAmount, 0, 0.8) * 0.12)
        : nzBase * (isIntervocalicLenition ? 1.45 : 1);
      const noiseEmphasisMul = event.ph === 's' || event.ph === 'x' ? 3 : 1;
      const voicelessNoiseMul = 1;
      const velarJNoiseMul = 1;
      const phonemeNoiseMul = isConsonantCore ? CONSONANT_NOISE_MUL : VOWEL_NOISE_MUL;
      addKeyframe(aspirationGain, start, localAspGain, curve);
      addKeyframe(aspirationGain, end, localAspGain, curve);
      // M1.3: +15% noise resonator gain on sibilants for definition.
      addKeyframe(noiseGain, start, localNzGain * noiseEmphasisMul * voicelessNoiseMul * velarJNoiseMul * phonemeNoiseMul, curve);
      addKeyframe(noiseGain, end, localNzGain * noiseEmphasisMul * voicelessNoiseMul * velarJNoiseMul * phonemeNoiseMul, curve);
      const sibilantCenter = event.ph === 's'
        ? 5600
        : isVelarJ
          ? 2750
        : Number.isFinite(profile.resFreq)
          ? profile.resFreq!
          : isFric
            ? 4200
            : 3000;
      addKeyframe(noiseCenterHz, start, sibilantCenter, curve);
      addKeyframe(noiseCenterHz, end, sibilantCenter, curve);
      addKeyframe(nasalZeroGain, start, isNasal ? 0.32 : 0, curve);
      addKeyframe(nasalZeroGain, end, isNasal ? 0.32 : 0, curve);

      // Persist end formants so the next phoneme can fade in from here.
      lastF1 = vowelF1;
      lastF2 = event.ph === 'ɲ' ? 2200 : vowelF2;
      lastF3 = formants.F3;
    }
  }

  return {
    f0: ensureTrajectoryFloor(f0),
    gain: ensureTrajectoryFloor(gain),
    voicingMix: ensureTrajectoryFloor(voicingMix),
    f1: ensureTrajectoryFloor(f1),
    f2: ensureTrajectoryFloor(f2),
    f3: ensureTrajectoryFloor(f3),
    b1: ensureTrajectoryFloor(b1),
    b2: ensureTrajectoryFloor(b2),
    b3: ensureTrajectoryFloor(b3),
    aspirationGain: ensureTrajectoryFloor(aspirationGain),
    noiseGain: ensureTrajectoryFloor(noiseGain),
    noiseCenterHz: ensureTrajectoryFloor(noiseCenterHz),
    nasalZeroGain: ensureTrajectoryFloor(nasalZeroGain),
  };
};

const resolveFrameParameters = (trajectories: ParameterTrajectories, timeMs: number): FrameParameterVector => {
  return {
    f0: sampleTrajectoryAtTime(trajectories.f0, timeMs),
    gain: sampleTrajectoryAtTime(trajectories.gain, timeMs),
    voicingMix: sampleTrajectoryAtTime(trajectories.voicingMix, timeMs),
    f1: sampleTrajectoryAtTime(trajectories.f1, timeMs),
    f2: sampleTrajectoryAtTime(trajectories.f2, timeMs),
    f3: sampleTrajectoryAtTime(trajectories.f3, timeMs),
    b1: sampleTrajectoryAtTime(trajectories.b1, timeMs),
    b2: sampleTrajectoryAtTime(trajectories.b2, timeMs),
    b3: sampleTrajectoryAtTime(trajectories.b3, timeMs),
    aspirationGain: sampleTrajectoryAtTime(trajectories.aspirationGain, timeMs),
    noiseGain: sampleTrajectoryAtTime(trajectories.noiseGain, timeMs),
    noiseCenterHz: sampleTrajectoryAtTime(trajectories.noiseCenterHz, timeMs),
    nasalZeroGain: sampleTrajectoryAtTime(trajectories.nasalZeroGain, timeMs),
  };
};

/**
 * Renders one frame of the continuous synthesis path.
 *
 * Accepts `startParams` (state at the beginning of the frame) and `endParams`
 * (state at the end of the frame) and linearly interpolates every DSP parameter
 * per-sample. This eliminates the phasing/zipper artefact caused by abrupt
 * resonator re-tuning at frame boundaries.
 *
 * The noise burst path (for oclusivas) is driven by `noiseGain` and routed
 * through `resonators[3]` which is tuned to the burst centre frequency.
 */
const renderContinuousFrame = (
  out: Float32Array,
  outOffset: number,
  sampleCount: number,
  startParams: FrameParameterVector,
  endParams: FrameParameterVector,
  sourceState: ContinuousSourceState,
  resonators: Array<{ cr: number; sr2: number; norm: number; re: number; im: number }>,
  voiceConfig: NarratorVoiceConfig,
): void => {
  const brightness = clamp(voiceConfig.roboti.brightness, 0.4, 2);
  const lfRd = clamp(voiceConfig.roboti.lfRd, 0.7, 2.7);
  const vocalNoise = 0.0008 + (clamp(voiceConfig.roboti.noiseAmount, 0, 0.8) * 0.0018);
  const norm = sampleCount > 1 ? 1 / (sampleCount - 1) : 1;
  // M1.5 intelligibility mode: disable jitter/shimmer for a cleaner robotic signal.
  const frameJitterMul = 1.0;
  const frameShimmerMul = 1.0;

  for (let i = 0; i < sampleCount; i += 1) {
    // ── Per-sample parameter interpolation ───────────────────────────────────
    // Interpolating here (not once per frame) eliminates resonator jumps that
    // cause phasing/zipper artefacts, especially across consonant boundaries.
    const t = i * norm;
    const f1i = startParams.f1 + (endParams.f1 - startParams.f1) * t;
    const f2i = startParams.f2 + (endParams.f2 - startParams.f2) * t;
    const f3i = startParams.f3 + (endParams.f3 - startParams.f3) * t;
    const b1i = startParams.b1 + (endParams.b1 - startParams.b1) * t;
    const b2i = startParams.b2 + (endParams.b2 - startParams.b2) * t;
    const b3i = startParams.b3 + (endParams.b3 - startParams.b3) * t;
    const frameGain = startParams.gain + (endParams.gain - startParams.gain) * t;
    const frameVoicingMix = startParams.voicingMix + (endParams.voicingMix - startParams.voicingMix) * t;
    const frameF0 = startParams.f0 + (endParams.f0 - startParams.f0) * t;
    const frameAsp = startParams.aspirationGain + (endParams.aspirationGain - startParams.aspirationGain) * t;
    const frameNoise = startParams.noiseGain + (endParams.noiseGain - startParams.noiseGain) * t;
    const frameNoiseCenter = startParams.noiseCenterHz + (endParams.noiseCenterHz - startParams.noiseCenterHz) * t;
    const frameNasalZero = startParams.nasalZeroGain + (endParams.nasalZeroGain - startParams.nasalZeroGain) * t;
    const isClosedVowelRegion = f1i <= 330 && (f2i >= 1800 || f2i <= 1100);

    // ── Re-tune formant resonators (smooth, per-sample) ──────────────────────
    retuneRes(resonators[0], f1i, naturalizeBandwidth(f1i, b1i));
    retuneRes(resonators[1], f2i, naturalizeBandwidth(f2i, b2i));
    retuneRes(resonators[2], f3i, naturalizeBandwidth(f3i, b3i));
    // Burst resonator (resonators[3]) tracks f1 at wider bandwidth.
    retuneRes(resonators[3], f1i, naturalizeBandwidth(f1i, b1i * 1.6));
    // Slight BW randomization breaks static phase-lock that can cause metallic ringing.
    const f4BwJitter = 1 + ((Math.random() - 0.5) * 0.1);
    const f5BwJitter = 1 + ((Math.random() - 0.5) * 0.1);
    retuneRes(resonators[4], 3500, 210 * BW_SAFETY_MUL * f4BwJitter);
    retuneRes(resonators[5], 4500, 280 * BW_SAFETY_MUL * f5BwJitter);
    // Noise color resonator for sibilant shaping; /x/ keeps narrower rough focus.
    const isVelarJRegion = frameNoiseCenter >= 2450 && frameNoiseCenter <= 3300;
    const isSibilantSRegion = frameNoiseCenter >= 5000;
    retuneRes(resonators[6], clamp(frameNoiseCenter, 2200, 7000), isVelarJRegion ? 420 : 950);
    // Nasal anti-resonator around ~1kHz.
    retuneRes(resonators[7], 1000, 220);

    // ── Voiced source path ────────────────────────────────────────────────────
    let voicedExc = 0;
    let voicedOut = 0;
    if (frameGain >= 0.0001) {
      const gl = lfLikeGlottalPulse(sourceState.glottalPhase, lfRd) * frameShimmerMul * frameVoicingMix;
      const aspNoise = stepLP(sourceState.aspirationLP, (Math.random() * 2 - 1)) * frameAsp;
      voicedExc = gl + aspNoise + ((Math.random() * 2 - 1) * vocalNoise);
      const s1 = stepRes(resonators[0], voicedExc);
      const s2 = stepRes(resonators[1], voicedExc);
      const s3 = stepRes(resonators[2], voicedExc);
      const s4 = stepRes(resonators[4], voicedExc);
      const s5 = stepRes(resonators[5], voicedExc);
      const nasalZero = stepRes(resonators[7], voicedExc) * frameNasalZero;
      voicedOut = (
        (s1 * 1.0)
        + (s2 * (0.66 + ((brightness - 1) * 0.08)))
        + (s3 * (0.36 + ((brightness - 1) * 0.16)))
        + (s4 * (0.25 + ((brightness - 1) * 0.06)) * (isClosedVowelRegion ? 1.22 : 1))
        + (s5 * (0.18 + ((brightness - 1) * 0.05)) * (isClosedVowelRegion ? 1.3 : 1))
        - (nasalZero * 0.9)
      ) * frameGain;
    } else {
      voicedExc = 0;
      voicedOut = 0;
    }

    // ── Noise burst path (oclusivas / fricativas) ─────────────────────────────
    // Driven by noiseGain trajectory; burst resonator shapes the spectrum.
    const rawNoise = Math.random() * 2 - 1;
    // Aggressive HP pre-filter for s/x to remove low-frequency voicing-like smear.
    const hpCutoff = isSibilantSRegion ? 4000 : isVelarJRegion ? 2000 : 1700;
    sourceState.noiseOutHP.alpha = clamp(2 * Math.sin((Math.PI * hpCutoff) / SAMPLE_RATE), 0.001, 1);
    const softenedNoise = stepLP(sourceState.noiseLP, stepHP(sourceState.noiseOutHP, rawNoise));
    const burstNoise = stepRes(resonators[3], softenedNoise) * (frameNoise * 0.6);
    const sibilantNoise = stepRes(resonators[6], softenedNoise) * (frameNoise * 0.85);
    // For fricative-like regions, route noise only through the sibilance resonator.
    const rawNoiseOut = (isSibilantSRegion || isVelarJRegion)
      ? sibilantNoise
      : (burstNoise + sibilantNoise);
    const frictionBoost = (isVelarJRegion || isSibilantSRegion) ? 1.4 : 1;
    const noiseOut = rawNoiseOut * frictionBoost;
    // Real output high-pass on the noise channel to avoid hum/"L"-like low resonances.
    sourceState.noiseHP.alpha = clamp(2 * Math.sin((Math.PI * hpCutoff) / SAMPLE_RATE), 0.001, 1);
    const noiseHP = stepHP(sourceState.noiseHP, noiseOut);

    let sample = voicedOut + noiseHP;
    if (!Number.isFinite(sample)) sample = 0;
    out[outOffset + i] = clamp(sample, -2, 2);
    if (frameGain >= 0.0001) {
      sourceState.glottalPhase += (frameF0 * frameJitterMul) / SAMPLE_RATE;
    }
  }
};

const renderPhonemeBuf = (
  ph: string,
  f0: number,
  vb: number,
  speed: number,
  sr: number,
  voiceConfig: NarratorVoiceConfig,
  prosody?: { durationMul?: number; pitchMul?: number; energyMul?: number },
  context?: { prevPh?: string; nextPh?: string },
): { buf: Float32Array; hasNaN: boolean } => {
  const pd = PH[ph];
  const durationMul = clamp(prosody?.durationMul ?? 1, 0.72, 1.5);
  const pitchMul = clamp(prosody?.pitchMul ?? 1, 0.82, 1.24);
  const energyMul = clamp(prosody?.energyMul ?? 1, 0.8, 1.22);
  const localSpeed = clamp(speed / durationMul, 0.15, 3);
  const localF0 = f0 * pitchMul;
  if (!pd) return { buf: new Float32Array(Math.round((30 / 1000) * sr)), hasNaN: false };
  if (pd.t === 'sil') {
    const durationMs = resolveSilenceDurationMs(ph, voiceConfig);
    return {
      buf: buildBreathSilence(Math.max(1, Math.round((durationMs / 1000) * sr)), clamp(voiceConfig.roboti.noiseAmount, 0, 0.8)),
      hasNaN: false,
    };
  }

  const baseDur = pd.dur || 60;
  const durVar = 1.0 + (Math.random() - 0.5) * 2 * (ph === 'β' || ph === 'ð' || ph === 'ɣ' ? 0.15 : 0.0);
  const dur = (baseDur * durVar) / localSpeed;
  const n = Math.max(8, Math.round((dur / 1000) * sr));
  let buf = new Float32Array(n);
  const amp = (pd.amp || 0.5) * energyMul;
  const brightness = clamp(voiceConfig.roboti.brightness, 0.4, 2);
  const noiseAmount = clamp(voiceConfig.roboti.noiseAmount, 0, 0.8);
  const lfRd = clamp(voiceConfig.roboti.lfRd, 0.7, 2.7);
  const aspiration = clamp(voiceConfig.roboti.aspiration, 0, 0.8);
  const vocalNoise = 0.001 + (noiseAmount * 0.0022);
  const aspirationNoiseBase = 0.00045 + (aspiration * 0.0032);
  // M1.6 diagnostic mode: legacy-path jitter/shimmer disabled.
  const microJitter = 0;
  const microShimmer = 0;
  const sustainedVowel = pd.t === 'v' && dur >= 100;
  const sustainedVibratoDepth = sustainedVowel ? (0.002 * (0.85 + (clamp(vb, 0, 100) / 100) * 0.15)) : 0;
  const sustainedVibratoHz = 5;
  let phLocal = gPhase;
  let hasNaN = false;

  try {
    if (pd.t === 'n') {
      const rb = [
        makeRes(pd.F1!, naturalizeBandwidth(pd.F1!, (pd.B1 ?? 60) * 1.9)),
        makeRes(pd.F2!, naturalizeBandwidth(pd.F2!, pd.B2!)),
        makeRes(pd.F3!, naturalizeBandwidth(pd.F3!, pd.B3!)),
        makeRes(pd.F4!, naturalizeBandwidth(pd.F4!, pd.B4!)),
      ];
      const antiRes = makeRes(1000, 220);
      const aspirationLP = makeLP(4000);
      for (let ii = 0; ii < n; ii += 1) {
        const t = ii / sr;
        const jitterMul = 1 + ((Math.random() * 2 - 1) * microJitter);
        const shimmerMul = 1 + ((Math.random() * 2 - 1) * microShimmer);
        const vib = sustainedVibratoDepth > 0 ? (sustainedVibratoDepth * Math.sin((Math.PI * 2 * sustainedVibratoHz) * t)) : 0;
        const instF = localF0 * (1 + vib) * jitterMul;
        const inc = instF / sr;
        const gl = lfLikeGlottalPulse(phLocal, lfRd) * shimmerMul;
        const aspirationNoise = stepLP(aspirationLP, (Math.random() * 2 - 1)) * aspirationNoiseBase * 0.58;
        const exc = gl + aspirationNoise + ((Math.random() * 2 - 1) * vocalNoise);
        const s1 = stepRes(rb[0], exc);
        const s2 = stepRes(rb[1], exc);
        const s3 = stepRes(rb[2], exc);
        const s4 = stepRes(rb[3], exc);
        const anti = stepRes(antiRes, exc);
        let val = (
          (s1 * 1.02)
          + (s2 * (0.6 + ((brightness - 1) * 0.08)))
          + (s3 * (0.31 + ((brightness - 1) * 0.14)))
          + (s4 * (0.12 + ((brightness - 1) * 0.05)))
          - (anti * 0.28)
        ) * amp;
        if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
        if (val > 1.8) val = 1.8;
        if (val < -1.8) val = -1.8;
        buf[ii] = val;
        phLocal += inc;
      }
    } else if (pd.t === 'v' || pd.t === 'sv' || pd.t === 'l' || pd.t === 'tap') {
      const coart = getCoarticulationFormants(ph, pd, context?.prevPh);
      const diphthongTransitionMs = isVowelLikeSymbol(ph) && isVowelLikeSymbol(context?.prevPh ?? '')
        ? clamp(70, 60, 80)
        : clamp(voiceConfig.roboti.transitionMs * 1.7, 20, 50);
      const transitionSamples = Math.min(n - 1, coart.transitionSamples || Math.round((diphthongTransitionMs / 1000) * sr));
      const isClosedVowel = ph === 'i' || ph === 'u';
      const bwMul = isClosedVowel ? 1.12 : 1;
      const rb = [
        makeRes(coart.start.F1, naturalizeBandwidth(coart.start.F1, coart.start.B1 * bwMul)),
        makeRes(coart.start.F2, naturalizeBandwidth(coart.start.F2, coart.start.B2 * bwMul)),
        makeRes(coart.start.F3, naturalizeBandwidth(coart.start.F3, coart.start.B3)),
        makeRes(coart.start.F4, naturalizeBandwidth(coart.start.F4, coart.start.B4)),
      ];
      const aspirationLP = makeLP(4300);
      const prevIsVoicelessStop = isVoicelessStopSymbol(context?.prevPh ?? '');
      const stopRecoverySamples = prevIsVoicelessStop
        ? Math.max(1, Math.round((3 * sr) / Math.max(60, localF0)))
        : 0;
      for (let ii = 0; ii < n; ii += 1) {
        const t = ii / sr;
        const jitterMul = 1 + ((Math.random() * 2 - 1) * microJitter);
        const shimmerMul = 1 + ((Math.random() * 2 - 1) * microShimmer);
        const instF = localF0 * (1 + vb * 0.0003 * Math.sin((Math.PI * 2 * 5.5) * t)) * jitterMul;
        const inc = instF / sr;
        if (transitionSamples > 2 && ii <= transitionSamples) {
          const shape = sigmoid01(ii / transitionSamples);
          const f1 = coart.start.F1 + ((coart.end.F1 - coart.start.F1) * shape);
          const f2 = coart.start.F2 + ((coart.end.F2 - coart.start.F2) * shape);
          const f3 = coart.start.F3 + ((coart.end.F3 - coart.start.F3) * shape);
          const f4 = coart.start.F4 + ((coart.end.F4 - coart.start.F4) * shape);
          const b1 = (coart.start.B1 + ((coart.end.B1 - coart.start.B1) * shape)) * bwMul;
          const b2 = (coart.start.B2 + ((coart.end.B2 - coart.start.B2) * shape)) * bwMul;
          const b3 = coart.start.B3 + ((coart.end.B3 - coart.start.B3) * shape);
          const b4 = coart.start.B4 + ((coart.end.B4 - coart.start.B4) * shape);
          retuneRes(rb[0], f1, naturalizeBandwidth(f1, b1));
          retuneRes(rb[1], f2, naturalizeBandwidth(f2, b2));
          retuneRes(rb[2], f3, naturalizeBandwidth(f3, b3));
          retuneRes(rb[3], f4, naturalizeBandwidth(f4, b4));
        }
        const stopSoftStart = stopRecoverySamples > 0
          ? Math.min(1, (ii + 1) / stopRecoverySamples)
          : 1;
        const gl = lfLikeGlottalPulse(phLocal, lfRd) * shimmerMul * stopSoftStart;
        const attackAsp = ii < n * 0.22 ? 1 - (0.45 * (ii / Math.max(1, n * 0.22))) : 0.55;
        const aspirationNoise = stepLP(aspirationLP, (Math.random() * 2 - 1)) * aspirationNoiseBase * attackAsp * (0.7 + (0.3 * stopSoftStart));
        const exc = gl + aspirationNoise + ((Math.random() * 2 - 1) * vocalNoise);
        const s1 = stepRes(rb[0], exc);
        const s2 = stepRes(rb[1], exc);
        const s3 = stepRes(rb[2], exc);
        const s4 = stepRes(rb[3], exc);
        let val = (
          (s1 * 1.0)
          + (s2 * (0.66 + ((brightness - 1) * 0.08)))
          + (s3 * (0.36 + ((brightness - 1) * 0.16)))
          + (s4 * (0.16 + ((brightness - 1) * 0.07)))
        ) * amp;
        if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
        if (val > 1.8) val = 1.8;
        if (val < -1.8) val = -1.8;
        buf[ii] = val;
        phLocal += inc;
      }
    } else if (pd.t === 'trill') {
      const rb = [
        makeRes(pd.F1!, naturalizeBandwidth(pd.F1!, pd.B1!)),
        makeRes(pd.F2!, naturalizeBandwidth(pd.F2!, pd.B2!)),
        makeRes(pd.F3!, naturalizeBandwidth(pd.F3!, pd.B3!)),
        makeRes(pd.F4!, naturalizeBandwidth(pd.F4!, pd.B4!)),
      ];
      const speedScale = clamp(speed, 0.2, 2);
      const trHz = (pd.trillHz || 28) * (speedScale > 1 ? (1 + ((speedScale - 1) * 0.35)) : 1);
      const trPer = sr / trHz;
      const aspirationLP = makeLP(4200);
      for (let ii = 0; ii < n; ii += 1) {
        const t = ii / sr;
        const jitterMul = 1 + ((Math.random() * 2 - 1) * microJitter);
        const shimmerMul = 1 + ((Math.random() * 2 - 1) * microShimmer);
        const instF = localF0 * jitterMul;
        const inc = instF / sr;
        const gl = lfLikeGlottalPulse(phLocal, lfRd) * shimmerMul;
        const aspirationNoise = stepLP(aspirationLP, (Math.random() * 2 - 1)) * aspirationNoiseBase * 0.65;
        const exc = gl + aspirationNoise + (Math.random() * 2 - 1) * vocalNoise;
        const cycPos = (ii % trPer) / trPer;
        const duty = 0.5;
        const edgeW = 0.06;
        const gateOn = cycPos < duty
          ? 1
          : cycPos < duty + edgeW
            ? 1 - ((cycPos - duty) / edgeW)
            : 0;
        const am = 0.5 + (0.5 * gateOn);
        const s1 = stepRes(rb[0], exc);
        const s2 = stepRes(rb[1], exc);
        const s3 = stepRes(rb[2], exc);
        const s4 = stepRes(rb[3], exc);
        const voicedFull = (
          (s1 * 1.0)
          + (s2 * (0.66 + ((brightness - 1) * 0.08)))
          + (s3 * (0.36 + ((brightness - 1) * 0.16)))
          + (s4 * (0.16 + ((brightness - 1) * 0.07)))
        );
        const voicedLeak = (
          (s1 * 0.34)
          + (s2 * 0.12)
          + (s3 * 0.06)
          + (s4 * 0.03)
        );
        let val = (voicedLeak * (1 - gateOn) + voicedFull * gateOn) * am * amp;
        if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
        if (val > 1.8) val = 1.8;
        if (val < -1.8) val = -1.8;
        buf[ii] = val;
        phLocal += inc;
      }
    } else if (pd.t === 'stop') {
      const baseClosureLen = Math.round(n * (pd.closurePct || 0.5));
      const votClosureLen = (ph === 'p' || ph === 't' || ph === 'k') ? Math.round(0.02 * sr) : 0;
      const closureLen = Math.min(n - 1, Math.max(baseClosureLen, votClosureLen));
      const intensity = pd.intensity || 0.4;
      for (let ii = 0; ii < closureLen; ii += 1) buf[ii] = 0;
      const attackSamples = Math.max(1, Math.round(0.002 * sr));
      const decaySamples = Math.max(attackSamples + 1, Math.round((ph === 'p' ? 0.01 : 0.007) * sr));
      const releaseWindow = Math.max(1, n - closureLen);
      const burstNoise = generatePinkNoise(releaseWindow);
      const burstLP = ph === 'p' || ph === 'k' ? makeLP(ph === 'p' ? 1000 : 2800) : null;
      const burstHP = ph === 't' || ph === 'k' ? makeHP(ph === 't' ? 4000 : 1400) : null;
      for (let ii = closureLen; ii < n; ii += 1) {
        const localIndex = ii - closureLen;
        let sample = burstNoise[Math.min(localIndex, burstNoise.length - 1)] * 0.9;
        if (burstLP) sample = stepLP(burstLP, sample);
        if (burstHP) sample = stepHP(burstHP, sample);
        const attackEnv = localIndex < attackSamples ? (localIndex + 1) / attackSamples : 1;
        const decayEnv = Math.exp(-localIndex / decaySamples);
        let val = sample * attackEnv * decayEnv * intensity;
        if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
        if (val > 1.8) val = 1.8;
        if (val < -1.8) val = -1.8;
        buf[ii] = val;
      }
    } else if (pd.t === 'affricate') {
      const closureLen = Math.round(n * (pd.closurePct || 0.35));
      for (let ii = 0; ii < closureLen; ii += 1) buf[ii] = 0;
      const burstLP = makeLP(pd.burst || 3000);
      const noiseAmp = pd.noiseAmp || 0.35;
      for (let ii = closureLen; ii < n; ii += 1) {
        const bt = (ii - closureLen) / Math.max(1, (n - closureLen));
        const env = Math.exp(-bt * 4);
        let val = stepLP(burstLP, (Math.random() * 2 - 1)) * env * noiseAmp;
        if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
        if (val > 1.8) val = 1.8;
        if (val < -1.8) val = -1.8;
        buf[ii] = val;
      }
    } else if (pd.t === 'fric' || pd.t === 'fric_soft') {
      const isLenitedStop = (ph === 'b' || ph === 'd' || ph === 'g')
        && isVowelLikeSymbol(context?.prevPh ?? '')
        && isVowelLikeSymbol(context?.nextPh ?? '');
      const fricToVowel = isVowelLikeSymbol(context?.nextPh ?? '');
      const finalSibilant = ph === 's' && isPauseSymbol(context?.nextPh ?? '');
      const rawNoise = pd.noiseType === 'pink'
        ? generatePinkNoise(n)
        : Float32Array.from({ length: n }, () => (Math.random() * 2 - 1) * 0.2);
      const baseNoiseGain = 0.07 + (noiseAmount * 0.12);
      const noiseGain = isLenitedStop ? baseNoiseGain * 0.42 : baseNoiseGain;
      const hpFilter = pd.hpFreq ? makeHP(pd.hpFreq) : null;
      const fricLP = makeLP(pd.lpFreq || 3000);
      const fricResFreq = finalSibilant && Number.isFinite(pd.resFreq) ? (pd.resFreq! * 1.08) : pd.resFreq;
      const resFilter = fricResFreq && pd.resBw ? makeRes(fricResFreq, pd.resBw) : null;
      const vMix = pd.voiced
        ? (isLenitedStop ? clamp(0.9 - (noiseAmount * 0.1), 0.78, 0.9) : clamp(0.82 - (noiseAmount * 0.18), 0.62, 0.82))
        : 0.44;
      const aspirationLP = makeLP(3900);
      for (let ii = 0; ii < n; ii += 1) {
        const t4 = ii / n;
        let env2 = 1;
        if (t4 < 0.11) env2 = t4 / 0.11;
        if (t4 > 0.88) env2 = (1 - t4) / 0.12;
        if (fricToVowel && t4 > 0.55) {
          const fade = 1 - ((t4 - 0.55) / 0.45);
          env2 *= clamp(fade, 0.08, 1);
        }
        if (finalSibilant) {
          env2 *= Math.exp(-t4 * 2.1);
        }
        if (isLenitedStop) {
          env2 = 0.66 + (env2 * 0.34);
        }

        let filtered = rawNoise[ii] * noiseGain;
        if (hpFilter) filtered = stepHP(hpFilter, filtered);
        filtered = stepLP(fricLP, filtered);
        if (resFilter) filtered = stepRes(resFilter, filtered) * (1.32 + (brightness - 1) * 0.18);

        if (pd.voiced) {
          const jitterMul = 1 + ((Math.random() * 2 - 1) * microJitter);
          const shimmerMul = 1 + ((Math.random() * 2 - 1) * microShimmer);
          const instF2 = localF0 * (1 + vb * 0.0003 * Math.sin((Math.PI * 2 * 5.5) * ii / sr)) * jitterMul;
          const gl2 = lfLikeGlottalPulse(gPhase, lfRd) * shimmerMul;
          const aspirationMix = stepLP(aspirationLP, (Math.random() * 2 - 1)) * aspirationNoiseBase * 1.25;
          gPhase += instF2 / sr;
          let val = (filtered * (1 - vMix) + (gl2 + aspirationMix) * vMix) * env2 * amp;
          if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
          if (val > 2) val = 2;
          if (val < -2) val = -2;
          buf[ii] = val;
        } else {
          let val = filtered * env2 * amp;
          if (!Number.isFinite(val)) { val = 0; hasNaN = true; }
          if (val > 2) val = 2;
          if (val < -2) val = -2;
          buf[ii] = val;
        }
      }
    }
  } catch (e) {
    console.error('Error rendering', ph, e);
    hasNaN = true;
  }

  const rampLen = Math.min(Math.floor(0.009 * sr), Math.floor(n * 0.1));
  const nextIsPause = isPauseSymbol(context?.nextPh ?? '');
  const tailRampLen = nextIsPause
    ? Math.min(Math.floor(0.02 * sr), Math.floor(n * 0.18))
    : rampLen;
  if (rampLen > 1) {
    for (let ii = 0; ii < rampLen; ii += 1) buf[ii] *= ii / rampLen;
    for (let ii = n - tailRampLen; ii < n; ii += 1) buf[ii] *= (n - ii) / Math.max(1, tailRampLen);
  }

  const shouldAddBreathRelease = nextIsPause && VOICED_TRANSITION_TYPES.has(pd.t);
  if (shouldAddBreathRelease) {
    const releaseSamples = Math.max(1, Math.round(0.05 * sr));
    const out = new Float32Array(n + releaseSamples);
    out.set(buf, 0);
    for (let ii = 0; ii < releaseSamples; ii += 1) {
      const progress = ii / Math.max(1, releaseSamples - 1);
      const env = Math.exp(-progress * 5.6);
      out[n + ii] = (Math.random() * 2 - 1) * aspirationNoiseBase * 0.75 * env;
    }
    buf = out;
  }

  gPhase = phLocal;
  return { buf, hasNaN };
};

const concatWithCrossfadeAndPositions = (
  bufs: Float32Array[],
  overlapMs: number,
  sr: number,
  resolveJoinOverlapMs?: (previousIndex: number, currentIndex: number, defaultOverlapMs: number) => number,
): { signal: Float32Array; positions: Array<{ start: number; end: number }> } => {
  if (!bufs || !bufs.length) return { signal: new Float32Array(0), positions: [] };
  const ov = Math.round(Math.max(overlapMs, 12) / 1000 * sr);
  let result = bufs[0];
  const positions = [{ start: 0, end: result.length }];

  for (let kk = 1; kk < bufs.length; kk += 1) {
    const b2 = bufs[kk];
    if (!b2 || b2.length === 0) {
      positions.push({ start: positions[positions.length - 1].end, end: positions[positions.length - 1].end });
      continue;
    }
    const n1 = result.length;
    const n2 = b2.length;
    const joinOverlapMs = resolveJoinOverlapMs
      ? resolveJoinOverlapMs(kk - 1, kk, overlapMs)
      : overlapMs;
    const joinOverlapSamples = Math.round(Math.max(0, joinOverlapMs) / 1000 * sr);
    const actualOv = Math.min(joinOverlapSamples, n1, n2);
    const zeroRadius = Math.max(2, Math.min(Math.round(sr * 0.003), Math.floor(actualOv * 0.35)));
    const overlapStartResult = actualOv > 4 ? findNearestZeroCrossing(result, n1 - actualOv, zeroRadius) : n1 - actualOv;
    const overlapStartB2 = actualOv > 4 ? findNearestZeroCrossing(b2, 0, zeroRadius) : 0;
    const alignedOv = Math.min(actualOv, n1 - overlapStartResult, n2 - overlapStartB2);
    const out = new Float32Array(overlapStartResult + (n2 - overlapStartB2));
    for (let ii = 0; ii < overlapStartResult; ii += 1) out[ii] = result[ii];
    for (let ii = 0; ii < alignedOv; ii += 1) {
      const tt = ii / Math.max(1, alignedOv);
      const fo = 1 - tt * tt;
      const fi = tt * tt;
      out[overlapStartResult + ii] = result[overlapStartResult + ii] * fo + b2[overlapStartB2 + ii] * fi;
    }
    for (let ii = alignedOv; ii < (n2 - overlapStartB2); ii += 1) out[overlapStartResult + ii] = b2[overlapStartB2 + ii];
    result = out;
    const newStart = overlapStartResult;
    const newEnd = newStart + (n2 - overlapStartB2);
    positions.push({ start: newStart, end: newEnd });
  }

  return { signal: result, positions };
};

const postProcess = (buf: Float32Array): Float32Array => {
  for (let ii = 0; ii < buf.length; ii += 1) buf[ii] *= 0.85;

  // Smooth high-frequency grit to reduce alias-like sibilant texture.
  const lp = makeLP(8000);
  for (let ii = 0; ii < buf.length; ii += 1) {
    const low = stepLP(lp, buf[ii]);
    buf[ii] = low * 0.9 + buf[ii] * 0.1;
  }

  // M1.6 diagnostic mode: high-shelf disabled to inspect raw intelligibility.

  const q = Math.pow(2, -15);
  for (let ii = 0; ii < buf.length; ii += 1) buf[ii] += (Math.random() - Math.random()) * q;
  return buf;
};

const encodeWAV = (buf: Float32Array, sr: number): ArrayBuffer => {
  const len = buf.length;
  const ds = len * 2;
  const ab = new ArrayBuffer(44 + ds);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => { for (let kk = 0; kk < s.length; kk += 1) v.setUint8(o + kk, s.charCodeAt(kk)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + ds, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, ds, true);
  let o = 44;
  for (let ii = 0; ii < len; ii += 1) {
    const ss = Math.max(-1, Math.min(1, buf[ii]));
    v.setInt16(o, ss < 0 ? Math.round(ss * 32768) : Math.round(ss * 32767), true);
    o += 2;
  }
  return ab;
};

class RobotiFormantEngine {
  private audioContext: AudioContext | null = null;
  private readonly cache = new Map<string, Float32Array>();
  private readonly engineMode: 'legacySegmented' | 'continuousStream' = 'continuousStream';

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private trimCache(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) return;
    const keys = [...this.cache.keys()];
    while (keys.length > MAX_CACHE_ENTRIES) {
      const key = keys.shift();
      if (!key) continue;
      this.cache.delete(key);
    }
  }

  private getJoinOverlapSamples(
    previous: string,
    current: string,
    voiceConfig: NarratorVoiceConfig,
    previousSamples: number,
    currentSamples: number,
  ): number {
    if (isSilenceSymbol(previous) || isSilenceSymbol(current)) return 0;
    const baseMs = clamp(voiceConfig.roboti.transitionMs, 4, 30);
    const prevType = (PH[previous] ?? PH[' ']).t;
    const currentType = (PH[current] ?? PH[' ']).t;
    const voicedJoin = VOICED_TRANSITION_TYPES.has(prevType) && VOICED_TRANSITION_TYPES.has(currentType);
    const hardJoin = HARD_TRANSITION_TYPES.has(prevType) || HARD_TRANSITION_TYPES.has(currentType);
    const fricToVowelJoin = (prevType === 'fric' || prevType === 'fric_soft') && (currentType === 'v' || currentType === 'sv');
    const hasR = previous === 'r' || previous === 'ɾ' || current === 'r' || current === 'ɾ';
    const joinMs = hasR
      ? baseMs * 1.9
      : fricToVowelJoin
        ? baseMs * 1.85
      : voicedJoin
        ? baseMs * 1.45
      : hardJoin
        ? baseMs * 0.55
        : baseMs;
    return Math.max(0, Math.min(Math.round((joinMs / 1000) * SAMPLE_RATE), previousSamples, currentSamples));
  }

  private getDurationMs(symbol: string, voiceConfig: NarratorVoiceConfig, durationMul = 1): number {
    const pd = PH[symbol] ?? PH[' '];
    const speed = clamp(voiceConfig.speed, 0.2, 2);
    if (pd.t === 'sil') {
      return resolveSilenceDurationMs(symbol, voiceConfig);
    }
    const base = pd.dur / speed;
    const resolved = pd.t === 'v' ? base * 1.25 : pd.t === 'sv' ? base * 0.95 : base;
    return resolved * clamp(durationMul, 0.72, 1.5);
  }

  public estimateDurationMs(text: string, voiceConfig: NarratorVoiceConfig): number {
    const normalized = normalizeText(text);
    if (!normalized) return 0;
    const tokens = buildProsodyTokens(normalized);
    if (!tokens.length) return 0;
    let totalSamples = 0;
    for (let i = 0; i < tokens.length; i += 1) {
      const current = tokens[i];
      const currentSamples = Math.max(1, Math.round((this.getDurationMs(current.ph, voiceConfig, current.durationMul) / 1000) * SAMPLE_RATE));
      if (i === 0) { totalSamples += currentSamples; continue; }
      const previous = tokens[i - 1];
      const previousSamples = Math.max(1, Math.round((this.getDurationMs(previous.ph, voiceConfig, previous.durationMul) / 1000) * SAMPLE_RATE));
      const overlap = this.getJoinOverlapSamples(previous.ph, current.ph, voiceConfig, previousSamples, currentSamples);
      totalSamples += currentSamples - overlap;
    }
    return Math.max(0, Math.round((totalSamples / SAMPLE_RATE) * 1000));
  }

  public async play(options: PlayRobotiNarrationOptions): Promise<NarratorPlaybackHandle> {
    const text = normalizeText(options.text);
    if (!text) {
      return { durationMs: 0, stop: () => undefined, unload: () => undefined, finished: Promise.resolve() };
    }

    const context = this.getContext();
    if (context.state === 'suspended') await context.resume();

    const f0 = makeF0(options.voiceConfig);

    if (this.engineMode === 'continuousStream') {
      const tokens = buildProsodyTokens(text);
      const timeline = buildSynthesisTimeline(text, options.voiceConfig, tokens);
      const trajectories = buildParameterTrajectories(timeline, options.voiceConfig, f0);
      const totalSamples = Math.max(1, Math.round((timeline.totalMs / 1000) * SAMPLE_RATE));
      // Frame de 64 muestras: los saltos de frecuencia entre frames son ≤ 1.45 ms,
      // inaudibles gracias a la interpolación per-sample interior.
      const frameSize = 64;
      const signal = new Float32Array(totalSamples);
      const sourceState: ContinuousSourceState = {
        glottalPhase: 0,
        aspirationLP: makeLP(4200),
        noiseHP: makeHP(1500),
        noiseLP: makeLP(7800),
        noiseOutHP: makeHP(1700),
      };
      // resonators[0-2]: F1-F3, [3]: burst, [4-5]: fixed F4/F5,
      // [6]: sibilant color, [7]: nasal anti-resonator.
      const resonators = [
        makeRes(500, 80),
        makeRes(1500, 110),
        makeRes(2600, 140),
        makeRes(2000, 700),
        makeRes(3500, 210),
        makeRes(4500, 280),
        makeRes(5000, 900),
        makeRes(1000, 220),
      ];

      // Inicializamos prevParams con el estado en t=0 para que la primera
      // interpolación arranque desde el comienzo correcto de la trayectoria.
      let prevParams = resolveFrameParameters(trajectories, 0);

      for (let sampleOffset = 0; sampleOffset < totalSamples; sampleOffset += frameSize) {
        const count = Math.min(frameSize, totalSamples - sampleOffset);
        const nextFrameTimeMs = ((sampleOffset + count) / SAMPLE_RATE) * 1000;
        const nextParams = resolveFrameParameters(trajectories, nextFrameTimeMs);
        renderContinuousFrame(signal, sampleOffset, count, prevParams, nextParams, sourceState, resonators, options.voiceConfig);
        prevParams = nextParams;
      }

      // Single-pass normalisation + post-processing to avoid gain pumping.
      const normalizedSignal = postProcess(normalizeGlobalSignal(signal, 0.82));
      const durationMs = Math.max(0, Math.round((normalizedSignal.length / SAMPLE_RATE) * 1000));
      const wavAB = encodeWAV(normalizedSignal, SAMPLE_RATE);
      const blob = new Blob([wavAB], { type: 'audio/wav' });
      const objectUrl = URL.createObjectURL(blob);

      const audioBuffer = context.createBuffer(1, Math.max(1, normalizedSignal.length), SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(normalizedSignal.length ? normalizedSignal : new Float32Array([0]));

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      const gain = context.createGain();
      gain.gain.value = 0.93;
      source.connect(gain);
      gain.connect(context.destination);

      const startAt = context.currentTime + (AUDIO_START_DELAY_MS / 1000);
      source.start(startAt);
      source.stop(startAt + (durationMs / 1000));

      let isDone = false;
      let resolveFinished: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
      const resolveOnce = () => {
        if (isDone) return;
        isDone = true;
        resolveFinished();
      };

      const timeoutId = window.setTimeout(resolveOnce, Math.max(0, durationMs + AUDIO_START_DELAY_MS + 80));
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        URL.revokeObjectURL(objectUrl);
        resolveOnce();
      };

      const stop = () => {
        try { source.stop(); } catch {
          // ignore
        }
        source.disconnect();
        gain.disconnect();
        window.clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolveOnce();
      };

      return { durationMs, stop, unload: stop, finished };
    }

    const phonemes = buildProsodyTokens(text);
    const bufs: Float32Array[] = [];
    const positions: Array<{ start: number; end: number }> = [];
    const phonemeList: Array<{ ph: string }> = [];
    resetGlottal();

    logProgress('Analyze text');
    for (let ii = 0; ii < phonemes.length; ii += 1) {
      const token = phonemes[ii];
      const ph = token.ph;
      const prevPh = ii > 0 ? phonemes[ii - 1].ph : '';
      const nextPh = ii + 1 < phonemes.length ? phonemes[ii + 1].ph : '';
      const pd = PH[ph] ?? PH[' '];
      const key = `${SYNTH_CACHE_VERSION}|${ph}|${prevPh}|${nextPh}|${Math.round(this.getDurationMs(ph, options.voiceConfig, token.durationMul))}|${token.pitchMul.toFixed(3)}|${token.energyMul.toFixed(3)}|${options.voiceConfig.roboti.voice}|${options.voiceConfig.roboti.pitchSemitones.toFixed(2)}|${options.voiceConfig.roboti.vibratoPct.toFixed(0)}|${options.voiceConfig.roboti.brightness.toFixed(2)}|${options.voiceConfig.roboti.noiseAmount.toFixed(3)}|${options.voiceConfig.roboti.lfRd.toFixed(2)}|${options.voiceConfig.roboti.aspiration.toFixed(3)}|${options.voiceConfig.roboti.transitionMs.toFixed(0)}|${options.voiceConfig.roboti.spacePauseMs.toFixed(0)}|${options.voiceConfig.roboti.punctuationPauseMs.toFixed(0)}|${options.voiceConfig.roboti.volume.toFixed(2)}`;

      let buf = this.cache.get(key);
      if (!buf) {
        const rendered = renderPhonemeBuf(
          ph,
          f0,
          options.voiceConfig.roboti.vibratoPct,
          options.voiceConfig.speed,
          SAMPLE_RATE,
          options.voiceConfig,
          {
            durationMul: token.durationMul,
            pitchMul: token.pitchMul,
            energyMul: token.energyMul,
          },
          {
            prevPh,
            nextPh,
          },
        );
        buf = rendered.buf;
        const targetRMS = ph === 'a' ? 0.15 : ph === 'e' || ph === 'o' ? 0.11 : ph === 'i' || ph === 'u' ? 0.09 : pd.t === 'n' ? 0.1 : pd.t === 'l' || pd.t === 'sv' ? 0.09 : pd.t === 'fric' && !pd.voiced ? 0.1 : pd.t === 'fric_soft' ? 0.07 : pd.t === 'tap' || pd.t === 'trill' ? 0.07 : pd.t === 'affricate' ? 0.08 : 0.06;
        normalizePhoneme(buf, targetRMS);
        this.cache.set(key, buf);
        this.trimCache();
      }

      bufs.push(new Float32Array(buf));
      phonemeList.push({ ph });
      if (ii % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }

    logProgress('Concatenate');
    const concatResult = concatWithCrossfadeAndPositions(
      bufs,
      options.voiceConfig.roboti.transitionMs,
      SAMPLE_RATE,
      (previousIndex, currentIndex, defaultOverlapMs) => {
        const previousPh = phonemeList[previousIndex]?.ph ?? '';
        const currentPh = phonemeList[currentIndex]?.ph ?? '';
        if (isSilenceSymbol(previousPh) || isSilenceSymbol(currentPh)) {
          return 0;
        }
        const prevType = (PH[previousPh] ?? PH[' ']).t;
        const currentType = (PH[currentPh] ?? PH[' ']).t;
        const voicedJoin = VOICED_TRANSITION_TYPES.has(prevType) && VOICED_TRANSITION_TYPES.has(currentType);
        const hardJoin = HARD_TRANSITION_TYPES.has(prevType) || HARD_TRANSITION_TYPES.has(currentType);
        const fricToVowelJoin = (prevType === 'fric' || prevType === 'fric_soft') && (currentType === 'v' || currentType === 'sv');
        if (voicedJoin) return defaultOverlapMs * 1.45;
        if (fricToVowelJoin) return defaultOverlapMs * 1.85;
        if (hardJoin) return defaultOverlapMs * 0.55;
        return defaultOverlapMs;
      },
    );
    let signal = concatResult.signal;
    const pos = concatResult.positions;
    signal = normalizeGlobalSignal(signal, 0.82);
    signal = postProcess(signal);

    const durationMs = Math.max(0, Math.round((signal.length / SAMPLE_RATE) * 1000));
    const wavAB = encodeWAV(signal, SAMPLE_RATE);
    const blob = new Blob([wavAB], { type: 'audio/wav' });
    const objectUrl = URL.createObjectURL(blob);

    const audioBuffer = context.createBuffer(1, Math.max(1, signal.length), SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(signal.length ? signal : new Float32Array([0]));

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    const gain = context.createGain();
    gain.gain.value = 0.93;
    source.connect(gain);
    gain.connect(context.destination);

    const startAt = context.currentTime + (AUDIO_START_DELAY_MS / 1000);
    source.start(startAt);
    source.stop(startAt + (durationMs / 1000));

    let isDone = false;
    let resolveFinished: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
    const resolveOnce = () => {
      if (isDone) return;
      isDone = true;
      resolveFinished();
    };

    const timeoutId = window.setTimeout(resolveOnce, Math.max(0, durationMs + AUDIO_START_DELAY_MS + 80));
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      URL.revokeObjectURL(objectUrl);
      resolveOnce();
    };

    const stop = () => {
      try { source.stop(); } catch {
        // ignore
      }
      source.disconnect();
      gain.disconnect();
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolveOnce();
    };

    return { durationMs, stop, unload: stop, finished };
  }
}

const logProgress = (_label: string): void => undefined;

const robotiFormantEngine = new RobotiFormantEngine();

/**
 * Plays narration using the Roboti synthesizer.
 */
export async function playRobotiNarration(options: PlayRobotiNarrationOptions): Promise<NarratorPlaybackHandle> {
  return robotiFormantEngine.play(options);
}

/**
 * Estimates narration duration for the Roboti synthesizer.
 */
export function estimateRobotiNarrationDurationMs(text: string, voiceConfig: NarratorVoiceConfig): number {
  return robotiFormantEngine.estimateDurationMs(text, voiceConfig);
}
