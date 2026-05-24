import type { NarratorPlaybackHandle, NarratorVoiceConfig, NarratorQwenPersona } from '../narratorPlayback';
import { getSpanishDurationMultiplier, getSpanishPhoneme } from './spanishPhonemes';

type PlayQwenFormantNarrationOptions = {
  text: string;
  voiceConfig: NarratorVoiceConfig;
  locale?: string;
};

type VoicePreset = {
  baseFreq: number;
  pitchMul: number;
  brightness: number;
  formantShift: number;
  volume: number;
  jitter: number;
  transitionMul: number;
};

type QwenRenderParams = {
  baseFreq: number;
  brightness: number;
  formantShift: number;
  volume: number;
  jitter: number;
  transitionMul: number;
  vowelGlitch: number;
};

type StructuredItem =
  | { type: 'space' }
  | { type: 'pause'; duration: number; sentenceEnd?: boolean }
  | { type: 'word'; phonemes: string[]; sentenceEnd?: boolean };

type ProsodyItem =
  | { type: 'space'; duration: number }
  | { type: 'phoneme'; symbol: string; durationMul: number; pitchOffset: number };

type SynthStep = { symbol: string; durationMs: number; pitchOffset: number };

const SAMPLE_RATE = 44100;
const AUDIO_START_DELAY_MS = 35;
const MAX_CACHE_ENTRIES = 256;
const OUTPUT_HEADROOM_DB = -1.5;
const BASE_OVERLAP_MS = 12;
const MAX_OVERLAP_SAMPLES = 2048;
const TRIM_THRESHOLD = 0.0008;
const TRIM_RELATIVE_THRESHOLD_RATIO = 0.018;
const TRIM_PADDING_MS = 8;
const MIN_TRIM_REMOVAL_MS = 6;
const EDGE_FADE_MS = 3;
const MIX_TARGET_PEAK = 0.707; // -3 dBFS
const POST_MIX_LOW_PASS_HZ = 7600;
const POST_MIX_MAX_DELTA = 0.14;
const POST_NORMALIZE_LOW_PASS_HZ = 7000;
const POST_NORMALIZE_MAX_DELTA = 0.12;
const ENABLE_CONTEXTUAL_APPROXIMANTS = false;
const LONG_TEXT_CLARITY_WORD_THRESHOLD = 8;
const SYNTH_CACHE_VERSION = '2026-05-24-rx15';

const VOWEL_FORMANTS: Record<string, { f1: number; f2: number; f3: number; f1bw: number; f2bw: number; f3bw: number; amp: [number, number, number] }> = {
  a: { f1: 730, f2: 1090, f3: 2440, f1bw: 80, f2bw: 100, f3bw: 120, amp: [1.0, 0.5, 0.15] },
  e: { f1: 530, f2: 1840, f3: 2480, f1bw: 70, f2bw: 110, f3bw: 130, amp: [1.0, 0.4, 0.1] },
  i: { f1: 270, f2: 2290, f3: 3010, f1bw: 50, f2bw: 120, f3bw: 140, amp: [0.8, 0.5, 0.2] },
  o: { f1: 570, f2: 840, f3: 2410, f1bw: 75, f2bw: 90, f3bw: 110, amp: [1.0, 0.45, 0.12] },
  u: { f1: 300, f2: 870, f3: 2240, f1bw: 55, f2bw: 85, f3bw: 100, amp: [0.9, 0.4, 0.1] },
};

const CONSONANT_CONFIG: Record<string, { type: 'fricative' | 'nasal' | 'liquid' | 'trill' | 'plosive'; freq?: number; bw?: number; durMul?: number; burstFreq?: number; burstDur?: number; voiced?: boolean }> = {
  s: { type: 'fricative', freq: 6900, bw: 1800, durMul: 1.0 },
  f: { type: 'fricative', freq: 4200, bw: 1800, durMul: 0.9 },
  ch: { type: 'fricative', freq: 3800, bw: 2500, durMul: 1.1 },
  j: { type: 'fricative', freq: 1800, bw: 1200, durMul: 0.9 },
  x: { type: 'fricative', freq: 3200, bw: 1500, durMul: 0.8 },
  h: { type: 'fricative', freq: 1500, bw: 1000, durMul: 0.8 },
  z: { type: 'fricative', freq: 6000, bw: 2200, durMul: 0.85 },
  m: { type: 'nasal', durMul: 1.0 },
  n: { type: 'nasal', durMul: 1.0 },
  ntilde: { type: 'nasal', durMul: 1.1 },
  y: { type: 'liquid', durMul: 0.92 },
  l: { type: 'liquid', durMul: 1.0 },
  r: { type: 'liquid', durMul: 1.05 },
  r_init: { type: 'liquid', durMul: 1.12 },
  rr: { type: 'trill', durMul: 1.32 },
  p: { type: 'plosive', burstFreq: 800, burstDur: 0.04, durMul: 0.55 },
  t: { type: 'plosive', burstFreq: 3200, burstDur: 0.03, durMul: 0.55 },
  k: { type: 'plosive', burstFreq: 1600, burstDur: 0.035, durMul: 0.55 },
  c: { type: 'plosive', burstFreq: 2200, burstDur: 0.045, durMul: 0.72 },
  q: { type: 'plosive', burstFreq: 1600, burstDur: 0.035, durMul: 0.55 },
  b: { type: 'plosive', burstFreq: 700, burstDur: 0.04, voiced: true, durMul: 0.55 },
  d: { type: 'plosive', burstFreq: 2800, burstDur: 0.03, voiced: true, durMul: 0.55 },
  g: { type: 'plosive', burstFreq: 1400, burstDur: 0.035, voiced: true, durMul: 0.55 },
  b_ap: { type: 'liquid', durMul: 1.0 },
  d_ap: { type: 'liquid', durMul: 1.0 },
  g_ap: { type: 'liquid', durMul: 1.0 },
};

const VOICE_PRESETS: Record<NarratorQwenPersona, VoicePreset> = {
  male: { baseFreq: 120, pitchMul: 1.0, brightness: 1.0, formantShift: 1.0, volume: 0.7, jitter: 0.08, transitionMul: 0.3 },
  female: { baseFreq: 200, pitchMul: 1.3, brightness: 1.3, formantShift: 1.15, volume: 0.68, jitter: 0.08, transitionMul: 0.34 },
  child: { baseFreq: 260, pitchMul: 1.6, brightness: 1.5, formantShift: 1.25, volume: 0.66, jitter: 0.1, transitionMul: 0.38 },
  robot: { baseFreq: 150, pitchMul: 1.0, brightness: 0.6, formantShift: 0.9, volume: 0.72, jitter: 0.02, transitionMul: 0.14 },
};

const SOFT_CONSONANTS = new Set(['s', 'ch', 't', 'k']);
const HARSH_FRICATIVES = new Set(['s', 'z', 'ch', 'j', 'x']);
const HARD_PLOSIVES = new Set(['p', 't', 'k', 'c', 'q']);
const CLEAR_PLOSIVES = new Set(['c', 'k', 'q']);
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const normalizeText = (text: string): string => String(text ?? '').replace(/\s+/g, ' ').trim();
const isVowelSymbol = (symbol: string): boolean => VOWELS.has(symbol);
const isConsonantSymbol = (symbol: string): boolean => symbol !== '_' && !isVowelSymbol(symbol);
const isPhaseDependentSymbol = (symbol: string): boolean => {
  if (VOWELS.has(symbol)) return true;
  const consonant = CONSONANT_CONFIG[symbol];
  if (!consonant) return false;
  return consonant.type === 'nasal' || consonant.type === 'liquid' || consonant.type === 'trill' || (consonant.type === 'plosive' && Boolean(consonant.voiced));
};

const computeTransitionGlitchWeight = (currentSymbol: string, nextSymbol: string): number => {
  const isVowelToVowel = isVowelSymbol(currentSymbol) && isVowelSymbol(nextSymbol);
  if (isVowelToVowel) return 1;
  const isConsonantToConsonant = isConsonantSymbol(currentSymbol) && isConsonantSymbol(nextSymbol);
  if (isConsonantToConsonant) return 0.7;
  const isMixedTransition =
    (isVowelSymbol(currentSymbol) && isConsonantSymbol(nextSymbol))
    || (isConsonantSymbol(currentSymbol) && isVowelSymbol(nextSymbol));
  if (isMixedTransition) return 0.82;
  return 0;
};

const computeOverlapSamplesForBoundary = (
  currentStep: SynthStep,
  nextStep: SynthStep,
  params: QwenRenderParams,
): number => {
  if (currentStep.symbol === '_' || nextStep.symbol === '_') return 0;
  const isVV = isVowelSymbol(currentStep.symbol) && isVowelSymbol(nextStep.symbol);
  const isCC = isConsonantSymbol(currentStep.symbol) && isConsonantSymbol(nextStep.symbol);
  const baseOverlapMs = isVV ? BASE_OVERLAP_MS : (isCC ? 6 : 8);
  const boundaryCapSec = isVV ? 0.024 : (isCC ? 0.01 : 0.014);
  const baseOverlapSamples = Math.min(Math.round((baseOverlapMs * SAMPLE_RATE) / 1000), MAX_OVERLAP_SAMPLES);
  const durationSec = Math.max(0.01, currentStep.durationMs / 1000);
  const glitchWeight = computeTransitionGlitchWeight(currentStep.symbol, nextStep.symbol);
  const glitchAmount = params.vowelGlitch * glitchWeight;
  const boundaryScale = isVV ? 0.26 : (isCC ? 0.11 : 0.16);
  const adaptiveOverlapSec = Math.min(
    durationSec * params.transitionMul * (boundaryScale + (0.55 * glitchAmount)),
    durationSec * 0.22,
    boundaryCapSec,
  );
  const adaptiveOverlapSamples = adaptiveOverlapSec > 0 ? Math.round(adaptiveOverlapSec * SAMPLE_RATE) : 0;
  return Math.max(1, Math.max(baseOverlapSamples, adaptiveOverlapSamples));
};

const strictOverlapAdd = (buffers: Float32Array[], requestedOverlaps: number[]): Float32Array => {
  if (!buffers.length) return new Float32Array(0);
  if (buffers.length === 1) return new Float32Array(buffers[0]);

  let totalLength = buffers[0].length;
  for (let i = 1; i < buffers.length; i += 1) {
    const prev = buffers[i - 1];
    const curr = buffers[i];
    const overlap = Math.max(0, Math.min(requestedOverlaps[i - 1] ?? 0, prev.length, curr.length));
    totalLength += curr.length - overlap;
  }

  const finalBuffer = new Float32Array(Math.max(1, totalLength));
  finalBuffer.set(buffers[0], 0);
  let writeCursor = buffers[0].length;

  for (let i = 1; i < buffers.length; i += 1) {
    const current = buffers[i];
    const overlapSamples = Math.max(0, Math.min(requestedOverlaps[i - 1] ?? 0, writeCursor, current.length));

    if (overlapSamples > 0) {
      for (let j = 0; j < overlapSamples; j += 1) {
        const t = j / overlapSamples;
        const fadeIn = Math.sin((t * Math.PI) / 2);
        const fadeOut = Math.cos((t * Math.PI) / 2);
        const targetIndex = writeCursor - overlapSamples + j;
        finalBuffer[targetIndex] = (finalBuffer[targetIndex] * fadeOut) + (current[j] * fadeIn);
      }
    }

    const restLength = current.length - overlapSamples;
    if (restLength > 0) {
      finalBuffer.set(current.subarray(overlapSamples), writeCursor);
      writeCursor += restLength;
    }
  }

  return writeCursor === finalBuffer.length ? finalBuffer : finalBuffer.subarray(0, writeCursor);
};

const trimRealSilence = (buffer: Float32Array, threshold = TRIM_THRESHOLD): Float32Array => {
  if (!buffer.length) return buffer;

  const peak = computePeak(buffer);
  if (peak <= 0) return new Float32Array(0);
  const effectiveThreshold = Math.max(threshold, peak * TRIM_RELATIVE_THRESHOLD_RATIO);

  let start = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    if (Math.abs(buffer[i]) > effectiveThreshold) {
      start = i;
      break;
    }
  }
  if (start === -1) return new Float32Array(0);

  let end = start;
  for (let i = buffer.length - 1; i >= start; i -= 1) {
    if (Math.abs(buffer[i]) > effectiveThreshold) {
      end = i;
      break;
    }
  }

  const paddingSamples = Math.round((TRIM_PADDING_MS * SAMPLE_RATE) / 1000);
  const paddedStart = Math.max(0, start - paddingSamples);
  const paddedEnd = Math.min(buffer.length - 1, end + paddingSamples);
  const removedSamples = paddedStart + (buffer.length - 1 - paddedEnd);
  const minTrimRemovalSamples = Math.round((MIN_TRIM_REMOVAL_MS * SAMPLE_RATE) / 1000);
  if (removedSamples < minTrimRemovalSamples) {
    return new Float32Array(buffer);
  }
  return new Float32Array(buffer.subarray(paddedStart, paddedEnd + 1));
};

const applyEdgeFade = (buffer: Float32Array): Float32Array => {
  if (buffer.length < 2) return buffer;
  const fadeSamples = Math.max(1, Math.min(Math.round((EDGE_FADE_MS * SAMPLE_RATE) / 1000), Math.floor(buffer.length / 2)));

  for (let i = 0; i < fadeSamples; i += 1) {
    const t = (i + 1) / (fadeSamples + 1);
    const edgeGain = Math.sin((t * Math.PI) / 2);
    buffer[i] *= edgeGain;
    buffer[buffer.length - 1 - i] *= edgeGain;
  }

  return buffer;
};

const computePeak = (buffer: Float32Array): number => {
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
};

const toDbfs = (peak: number): number => {
  if (peak <= 0) return -120;
  return 20 * Math.log10(peak);
};

const removeDcOffset = (buffer: Float32Array, pole = 0.995): Float32Array => {
  if (buffer.length < 2) return buffer;
  let previousInput = buffer[0];
  let previousOutput = buffer[0];
  for (let i = 1; i < buffer.length; i += 1) {
    const input = buffer[i];
    const output = input - previousInput + (pole * previousOutput);
    buffer[i] = output;
    previousInput = input;
    previousOutput = output;
  }
  return buffer;
};

const constrainSampleDelta = (buffer: Float32Array, maxDelta = POST_MIX_MAX_DELTA): Float32Array => {
  if (buffer.length < 2) return buffer;
  let previous = buffer[0];
  for (let i = 1; i < buffer.length; i += 1) {
    const current = buffer[i];
    const delta = current - previous;
    if (delta > maxDelta) {
      buffer[i] = previous + maxDelta;
    } else if (delta < -maxDelta) {
      buffer[i] = previous - maxDelta;
    }
    previous = buffer[i];
  }
  return buffer;
};

const applyOnePoleLowPass = (buffer: Float32Array, cutoffHz = POST_MIX_LOW_PASS_HZ): Float32Array => {
  if (buffer.length < 2 || cutoffHz <= 0) return buffer;
  const x = Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE);
  const alpha = 1 - x;
  let previous = buffer[0];
  for (let i = 1; i < buffer.length; i += 1) {
    previous = previous + (alpha * (buffer[i] - previous));
    buffer[i] = previous;
  }
  return buffer;
};

const normalizeToPeak = (buffer: Float32Array, peakTarget = 0.95): Float32Array => {
  if (!buffer.length) return buffer;
  const peak = computePeak(buffer);
  if (peak <= 0) return buffer;
  const maxBoost = 2.2;
  const gain = peakTarget / peak;
  if (Math.abs(gain - 1) < 0.01) return buffer;
  const appliedGain = gain > 1 ? Math.min(gain, maxBoost) : gain;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] *= appliedGain;
  }
  return buffer;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
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

const getAudioContext = (): AudioContext => {
  const maybeWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const contextCtor = window.AudioContext ?? maybeWindow.webkitAudioContext;
  if (!contextCtor) {
    throw new Error('AudioContext not supported in this environment.');
  }
  return new contextCtor();
};

const getPauseDurationForPunctuation = (token: string): number => {
  if (token === ',') return 0.2;
  if (token === ';' || token === ':') return 0.26;
  if (token === '.' || token === '!' || token === '?') return 0.34;
  return 0.18;
};

const toPhonemes = (text: string): StructuredItem[] => {
  const processed = normalizeText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ch/g, '§')
    .replace(/ll/g, '¶')
    .replace(/rr/g, '~')
    .replace(/qu/g, 'k')
    .replace(/ce/g, 'se')
    .replace(/ci/g, 'si')
    .replace(/ge/g, 'je')
    .replace(/gi/g, 'ji');

  const allTokens: string[] = [];
  for (const char of processed) {
    if (char === '§') allTokens.push('ch');
    else if (char === '¶') allTokens.push('y');
    else if (char === '~') allTokens.push('rr');
    else if (char === 'ñ') allTokens.push('ntilde');
    else if (/[a-z]/.test(char)) allTokens.push(char);
    else if (char === ' ') allTokens.push('_');
    else if ('.;,!?:'.includes(char)) allTokens.push(char);
  }

  const normalizeWordTokens = (wordTokens: string[]): string[] => {
    if (!wordTokens.length) return wordTokens;
    if (wordTokens.length === 1 && wordTokens[0] === 'y') return ['i'];

    const normalized: string[] = [];
    for (let i = 0; i < wordTokens.length; i += 1) {
      const token = wordTokens[i];
      if (token !== 'y') {
        normalized.push(token);
        continue;
      }

      const prev = i > 0 ? wordTokens[i - 1] : '';
      const next = i < wordTokens.length - 1 ? wordTokens[i + 1] : '';
      const prevIsVowel = VOWELS.has(prev);
      const nextIsVowel = VOWELS.has(next);

      // Spanish yeismo: initial/intervocalic y behaves as consonant, final y after vowel as /i/.
      if (i === wordTokens.length - 1 && prevIsVowel) {
        normalized.push('i');
      } else if (nextIsVowel || (!prevIsVowel && !nextIsVowel)) {
        normalized.push('y');
      } else {
        normalized.push('i');
      }
    }

    const contextual: string[] = [];
    for (let i = 0; i < normalized.length; i += 1) {
      const token = normalized[i];
      const prev = i > 0 ? normalized[i - 1] : '';
      const next = i < normalized.length - 1 ? normalized[i + 1] : '';
      const prevIsVowel = VOWELS.has(prev);
      const nextIsVowel = VOWELS.has(next);

      if (token === 'r') {
        if (i === 0 || prev === 'l' || prev === 'n' || prev === 's') {
          contextual.push('r_init');
        } else {
          contextual.push('r');
        }
        continue;
      }

      if (ENABLE_CONTEXTUAL_APPROXIMANTS && (token === 'b' || token === 'd' || token === 'g') && prevIsVowel && nextIsVowel) {
        contextual.push(`${token}_ap`);
        continue;
      }

      contextual.push(token);
    }

    return contextual;
  };

  const result: StructuredItem[] = [];
  let currentWord: string[] = [];
  for (const token of allTokens) {
    if (token === '_') {
      if (currentWord.length > 0) {
        result.push({ type: 'word', phonemes: normalizeWordTokens(currentWord) });
        currentWord = [];
      }
      result.push({ type: 'space' });
      continue;
    }
    if ('.;,!?:'.includes(token)) {
      if (currentWord.length > 0) {
        result.push({
          type: 'word',
          phonemes: normalizeWordTokens(currentWord),
          sentenceEnd: token === '.' || token === '!' || token === '?',
        });
        currentWord = [];
      }
      result.push({
        type: 'pause',
        duration: getPauseDurationForPunctuation(token),
        sentenceEnd: token === '.' || token === '!' || token === '?',
      });
      continue;
    }
    currentWord.push(token);
  }
  if (currentWord.length > 0) {
    result.push({ type: 'word', phonemes: normalizeWordTokens(currentWord) });
  }

  return result;
};

const generateProsody = (structured: StructuredItem[], options?: { clarityMode?: boolean }): ProsodyItem[] => {
  const result: ProsodyItem[] = [];
  const clarityMode = Boolean(options?.clarityMode);

  for (const item of structured) {
    if (item.type === 'space') {
      result.push({ type: 'space', duration: clarityMode ? 0.21 : 0.17 });
      continue;
    }

    if (item.type === 'pause') {
      result.push({ type: 'space', duration: clarityMode ? item.duration * 1.15 : item.duration });
      continue;
    }

    const vowelIndexes: number[] = [];
    item.phonemes.forEach((phoneme, index) => {
      if (['a', 'e', 'i', 'o', 'u'].includes(phoneme)) {
        vowelIndexes.push(index);
      }
    });

    const stressIdx = vowelIndexes.length > 1
      ? vowelIndexes[vowelIndexes.length - 2]
      : vowelIndexes.length === 1
        ? vowelIndexes[0]
        : 0;

    for (let index = 0; index < item.phonemes.length; index += 1) {
      const symbol = item.phonemes[index];
      const isVowel = ['a', 'e', 'i', 'o', 'u'].includes(symbol);
      let pitchOffset = 0;
      let durationMul = CONSONANT_CONFIG[symbol]?.durMul ?? 1;

      if (isVowel) {
        const pos = index / Math.max(item.phonemes.length - 1, 1);
        durationMul = clarityMode ? 1.28 : 1.18;
        if (index === stressIdx) {
          pitchOffset = clarityMode ? 0.14 : 0.23;
          durationMul = clarityMode ? 1.52 : 1.36;
        }
        if (item.sentenceEnd) {
          pitchOffset += (clarityMode ? -0.2 : -0.28) * pos;
        } else {
          pitchOffset += clarityMode ? 0.015 : 0.04;
        }
      } else {
        pitchOffset = -0.05;
        durationMul *= getSpanishDurationMultiplier(symbol, 90);
        durationMul = Math.max(0.78, durationMul);
        const prevSymbol = index > 0 ? item.phonemes[index - 1] : '';
        const nextSymbol = index < item.phonemes.length - 1 ? item.phonemes[index + 1] : '';
        if (isConsonantSymbol(prevSymbol) || isConsonantSymbol(nextSymbol)) {
          durationMul *= 1.14;
        }
        if (index === 0) {
          durationMul *= 1.12;
        }
      }

      result.push({ type: 'phoneme', symbol, durationMul, pitchOffset });
    }
  }

  return result;
};

const createNoiseBuffer = (ctx: OfflineAudioContext, sampleCount: number): AudioBuffer => {
  const buffer = ctx.createBuffer(1, sampleCount, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    channel[index] = (Math.random() * 2) - 1;
  }
  return buffer;
};

const createGlottalSource = (
  ctx: OfflineAudioContext,
  durationSec: number,
  baseFreq: number,
  phaseIn = 0,
): { source: AudioBufferSourceNode; phaseOut: number } => {
  const sampleCount = Math.max(1, Math.floor(SAMPLE_RATE * durationSec));
  const buffer = ctx.createBuffer(1, sampleCount, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  const safeBaseFreq = Math.max(40, baseFreq);
  let phase = phaseIn - Math.floor(phaseIn);
  const phaseStep = safeBaseFreq / SAMPLE_RATE;

  for (let index = 0; index < sampleCount; index += 1) {
    const t = phase;
    let sample = 0;
    if (t < 0.4) {
      sample = Math.sin((Math.PI * t) / 0.4) ** 2;
    } else if (t < 0.7) {
      sample = Math.cos((Math.PI * (t - 0.4)) / 0.6) ** 1.5;
    }
    channel[index] = sample;
    phase += phaseStep;
    if (phase >= 1) {
      phase -= Math.floor(phase);
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return { source, phaseOut: phase };
};

const renderPhonemeBuffer = async (
  symbol: string,
  durationMs: number,
  params: QwenRenderParams,
  pitchOffset: number,
  random: () => number,
  phaseIn = 0,
): Promise<{ buffer: AudioBuffer; phaseOut: number } | null> => {
  const durationSec = Math.max(0.02, durationMs / 1000);
  const sampleCount = Math.max(1, Math.round(SAMPLE_RATE * durationSec));
  const offlineCtx = new OfflineAudioContext(1, sampleCount, SAMPLE_RATE);
  const { baseFreq, brightness, formantShift, volume, jitter } = params;

  const masterGain = offlineCtx.createGain();
  const phonemeCompressor = offlineCtx.createDynamicsCompressor();
  phonemeCompressor.threshold.value = -20;
  phonemeCompressor.knee.value = 10;
  phonemeCompressor.ratio.value = 3;
  phonemeCompressor.attack.value = 0.002;
  phonemeCompressor.release.value = 0.06;
  const attack = Math.min(0.005, durationSec * 0.2);
  const release = Math.min(0.01, durationSec * 0.26);
  masterGain.gain.setValueAtTime(0, offlineCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume, offlineCtx.currentTime + attack);
  masterGain.gain.setValueAtTime(volume, Math.max(offlineCtx.currentTime + attack, durationSec - release));
  masterGain.gain.linearRampToValueAtTime(0, durationSec);
  masterGain.connect(phonemeCompressor);
  phonemeCompressor.connect(offlineCtx.destination);

  const adjustedBaseFreq = baseFreq * (1 + (random() * jitter - jitter / 2));
  const targetFreq = adjustedBaseFreq * (1 + pitchOffset);
  let phaseOut = phaseIn;

  if (VOWEL_FORMANTS[symbol]) {
    const fallbackVowel = VOWEL_FORMANTS[symbol];
    const vowelData = getSpanishPhoneme(symbol);
    const vowel = {
      f1: vowelData?.formants.F1 ?? fallbackVowel.f1,
      f2: vowelData?.formants.F2 ?? fallbackVowel.f2,
      f3: vowelData?.formants.F3 ?? fallbackVowel.f3,
      f1bw: vowelData?.formants.B1 ?? fallbackVowel.f1bw,
      f2bw: vowelData?.formants.B2 ?? fallbackVowel.f2bw,
      f3bw: vowelData?.formants.B3 ?? fallbackVowel.f3bw,
      amp: fallbackVowel.amp,
    };
    const glottal = createGlottalSource(offlineCtx, durationSec, targetFreq, phaseIn);
    const source = glottal.source;
    phaseOut = glottal.phaseOut;

    const formants: Array<{ freq: number; bw: number; amp: number }> = [
      { freq: vowel.f1 * formantShift, bw: vowel.f1bw, amp: vowel.amp[0] * brightness },
      { freq: vowel.f2 * formantShift, bw: vowel.f2bw, amp: vowel.amp[1] * brightness },
      { freq: vowel.f3 * formantShift, bw: vowel.f3bw, amp: vowel.amp[2] * brightness },
    ];

    formants.forEach((formant) => {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = formant.freq;
      filter.Q.value = Math.max(0.1, formant.freq / formant.bw);
      const gain = offlineCtx.createGain();
      gain.gain.value = formant.amp;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
    });

    source.start();
    source.stop(durationSec);
    return { buffer: await offlineCtx.startRendering(), phaseOut };
  }

  const consonant = CONSONANT_CONFIG[symbol];
  if (!consonant) {
    return null;
  }

  if (consonant.type === 'fricative') {
    const phonemeData = getSpanishPhoneme(symbol);
    const noise = offlineCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(offlineCtx, sampleCount);
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'bandpass';
    const fricativeFreq = phonemeData?.spectralPeak ?? consonant.freq ?? 2200;
    const fricativeBandwidth = phonemeData?.bandwidth ?? consonant.bw ?? 1600;
    filter.frequency.value = fricativeFreq;
    filter.Q.value = Math.max(0.1, (fricativeFreq / fricativeBandwidth) * 0.82);
    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = symbol === 's'
      ? 6200
      : (HARSH_FRICATIVES.has(symbol) ? 4700 : 5600);
    lowPass.Q.value = 0.707;
    const gain = offlineCtx.createGain();
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.05;
    const soften = SOFT_CONSONANTS.has(symbol) ? 0.82 : 1;
    const consonantAttack = Math.min(SOFT_CONSONANTS.has(symbol) ? 0.006 : 0.004, durationSec * 0.18);
    const consonantRelease = Math.min(SOFT_CONSONANTS.has(symbol) ? 0.016 : 0.01, durationSec * 0.3);
    gain.gain.setValueAtTime(0, offlineCtx.currentTime);
    const consonantPeak = symbol === 's'
      ? volume * 0.52 * brightness * soften
      : volume * 0.44 * brightness * soften;
    gain.gain.linearRampToValueAtTime(consonantPeak, offlineCtx.currentTime + consonantAttack);
    gain.gain.setValueAtTime(consonantPeak, Math.max(consonantAttack, durationSec - consonantRelease));
    gain.gain.linearRampToValueAtTime(0, durationSec);
    noise.connect(filter);
    filter.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(compressor);
    compressor.connect(masterGain);
    noise.start();
    noise.stop(durationSec);
    return { buffer: await offlineCtx.startRendering(), phaseOut };
  }

  if (consonant.type === 'nasal' || consonant.type === 'liquid') {
    const phonemeData = getSpanishPhoneme(symbol);
    if (symbol === 'b_ap' || symbol === 'd_ap' || symbol === 'g_ap') {
      const glottal = createGlottalSource(offlineCtx, durationSec, targetFreq * 0.88, phaseIn);
      const source = glottal.source;
      phaseOut = glottal.phaseOut;

      const dryGain = offlineCtx.createGain();
      dryGain.gain.value = 0.42;

      const formant1 = offlineCtx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.value = phonemeData?.formants.F1 ?? 420;
      formant1.Q.value = 0.62;

      const formant2 = offlineCtx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.value = phonemeData?.formants.F2 ?? 1400;
      formant2.Q.value = 0.7;

      const formant3 = offlineCtx.createBiquadFilter();
      formant3.type = 'bandpass';
      formant3.frequency.value = phonemeData?.formants.F3 ?? 2450;
      formant3.Q.value = 0.84;

      const gain1 = offlineCtx.createGain();
      gain1.gain.value = 0.5;
      const gain2 = offlineCtx.createGain();
      gain2.gain.value = 0.44;
      const gain3 = offlineCtx.createGain();
      gain3.gain.value = 0.36;

      source.connect(dryGain);
      source.connect(formant1);
      source.connect(formant2);
      source.connect(formant3);
      dryGain.connect(masterGain);
      formant1.connect(gain1);
      formant2.connect(gain2);
      formant3.connect(gain3);
      gain1.connect(masterGain);
      gain2.connect(masterGain);
      gain3.connect(masterGain);
      source.start();
      source.stop(durationSec);
      return { buffer: await offlineCtx.startRendering(), phaseOut };
    }

    const glottal = createGlottalSource(offlineCtx, durationSec, targetFreq * (consonant.type === 'nasal' ? 0.85 : 0.95), phaseIn);
    const source = glottal.source;
    phaseOut = glottal.phaseOut;
    const filter = offlineCtx.createBiquadFilter();
    filter.type = symbol === 'y' || symbol === 'r' || symbol === 'r_init' ? 'bandpass' : 'lowpass';
    filter.frequency.value = symbol === 'y'
      ? 1900
      : (symbol === 'r'
        ? 1650
        : (symbol === 'r_init' ? 1550 : (consonant.type === 'nasal' ? 950 : 1450)));
    if (symbol === 'y') {
      filter.Q.value = 0.9;
    } else if (symbol === 'r') {
      filter.Q.value = 0.85;
    } else if (symbol === 'r_init') {
      filter.Q.value = 0.72;
    }
    const liquidGain = offlineCtx.createGain();
    liquidGain.gain.value = symbol === 'y'
      ? 1.08
      : (symbol === 'r' ? 1.14 : (symbol === 'r_init' ? 0.96 : 1));
    source.connect(filter);
    filter.connect(liquidGain);
    liquidGain.connect(masterGain);
    source.start();
    source.stop(durationSec);
    return { buffer: await offlineCtx.startRendering(), phaseOut };
  }

  if (consonant.type === 'trill') {
    const glottal = createGlottalSource(offlineCtx, durationSec, targetFreq, phaseIn);
    const source = glottal.source;
    phaseOut = glottal.phaseOut;
    const lfo = offlineCtx.createOscillator();
    lfo.frequency.value = symbol === 'rr' ? 30 : (symbol === 'r_init' ? 22 : 27);
    const lfoGain = offlineCtx.createGain();
    lfoGain.gain.value = symbol === 'r_init' ? 0.075 : 0.11;
    const trillGain = offlineCtx.createGain();
    trillGain.gain.setValueAtTime(symbol === 'r_init' ? 0.72 : 0.9, offlineCtx.currentTime);
    trillGain.gain.linearRampToValueAtTime(symbol === 'r_init' ? 0.86 : 1, Math.min(durationSec, offlineCtx.currentTime + 0.016));
    lfo.connect(lfoGain);
    lfoGain.connect(source.playbackRate);
    source.connect(trillGain);
    trillGain.connect(masterGain);
    lfo.start();
    source.start();
    lfo.stop(durationSec);
    source.stop(durationSec);
    return { buffer: await offlineCtx.startRendering(), phaseOut };
  }

  if (consonant.type === 'plosive') {
    const phonemeData = getSpanishPhoneme(symbol);
    const burstDuration = Math.min(durationSec, consonant.burstDur ?? 0.03);
    const burstFrames = Math.max(1, Math.round(SAMPLE_RATE * burstDuration));
    const noise = offlineCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(offlineCtx, burstFrames);

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = phonemeData?.spectralPeak ?? consonant.burstFreq ?? 1200;
    filter.Q.value = symbol === 'c' ? 1.05 : (SOFT_CONSONANTS.has(symbol) ? 0.7 : 0.9);
    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = symbol === 'c' ? 4700 : (HARD_PLOSIVES.has(symbol) ? 3600 : 4400);
    lowPass.Q.value = 0.707;

    const burstGain = offlineCtx.createGain();
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 14;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.045;
    burstGain.gain.setValueAtTime(0, offlineCtx.currentTime);
    const burstPeak = symbol === 'c'
      ? volume * 0.6
      : (SOFT_CONSONANTS.has(symbol) ? volume * 0.4 : volume * 0.52);
    burstGain.gain.linearRampToValueAtTime(burstPeak, offlineCtx.currentTime + Math.min(SOFT_CONSONANTS.has(symbol) ? 0.005 : 0.0035, burstDuration * 0.3));
    burstGain.gain.exponentialRampToValueAtTime(0.01, burstDuration);

    noise.connect(filter);
    filter.connect(lowPass);
    lowPass.connect(burstGain);
    burstGain.connect(compressor);
    compressor.connect(masterGain);
    noise.start();
    noise.stop(burstDuration);

    if (consonant.voiced) {
      const glottal = createGlottalSource(offlineCtx, burstDuration, targetFreq * 0.62, phaseIn);
      const voice = glottal.source;
      phaseOut = glottal.phaseOut;
      const voiceGain = offlineCtx.createGain();
      voiceGain.gain.value = volume * (SOFT_CONSONANTS.has(symbol) ? 0.28 : 0.35);
      voice.connect(voiceGain);
      voiceGain.connect(masterGain);
      voice.start();
      voice.stop(burstDuration);
    }

    if (CLEAR_PLOSIVES.has(symbol)) {
      const tailNoise = offlineCtx.createBufferSource();
      tailNoise.buffer = createNoiseBuffer(offlineCtx, burstFrames);
      const tailFilter = offlineCtx.createBiquadFilter();
      tailFilter.type = 'bandpass';
      tailFilter.frequency.value = symbol === 'c' ? 3000 : 2400;
      tailFilter.Q.value = 0.8;
      const tailGain = offlineCtx.createGain();
      tailGain.gain.setValueAtTime(0, offlineCtx.currentTime);
      tailGain.gain.linearRampToValueAtTime(volume * 0.18, offlineCtx.currentTime + Math.min(0.003, burstDuration * 0.25));
      tailGain.gain.exponentialRampToValueAtTime(0.001, Math.min(durationSec, burstDuration + 0.02));
      tailNoise.connect(tailFilter);
      tailFilter.connect(tailGain);
      tailGain.connect(masterGain);
      tailNoise.start();
      tailNoise.stop(Math.min(durationSec, burstDuration + 0.02));
    }

    return { buffer: await offlineCtx.startRendering(), phaseOut };
  }

  return null;
};

class QwenFormantEngine {
  private audioContext: AudioContext | null = null;
  private readonly cache = new Map<string, AudioBuffer>();

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = getAudioContext();
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

  private resolveParams(voiceConfig: NarratorVoiceConfig): QwenRenderParams {
    const preset = VOICE_PRESETS[voiceConfig.qwen.persona];
    return {
      baseFreq: preset.baseFreq * clamp(voiceConfig.qwen.pitchMul, 0.5, 2.5),
      brightness: clamp(voiceConfig.qwen.brightness, 0.3, 3),
      formantShift: preset.formantShift,
      volume: clamp(voiceConfig.qwen.volume, 0.1, 1),
      jitter: clamp(voiceConfig.qwen.jitter, 0, 0.3),
      transitionMul: clamp(voiceConfig.qwen.transitionMul, 0, 0.8),
      vowelGlitch: clamp(voiceConfig.qwen.vowelGlitch, 0, 1),
    };
  }

  private getSynthPlan(text: string, voiceConfig: NarratorVoiceConfig): SynthStep[] {
    const structured = toPhonemes(text);
    const wordCount = structured.filter((item) => item.type === 'word').length;
    const clarityMode = wordCount >= LONG_TEXT_CLARITY_WORD_THRESHOLD;
    const prosody = generateProsody(structured, { clarityMode });
    const phonemeItems = prosody.filter((item): item is Extract<ProsodyItem, { type: 'phoneme' }> => item.type === 'phoneme');
    const consonantCount = phonemeItems.filter((item) => isConsonantSymbol(item.symbol)).length;
    const consonantRatio = phonemeItems.length ? consonantCount / phonemeItems.length : 0;
    let phrasingSlowdown = 1;
    if (wordCount >= 10) {
      phrasingSlowdown += 0.12;
    } else if (wordCount >= 6) {
      phrasingSlowdown += 0.07;
    }
    if (clarityMode) {
      phrasingSlowdown += 0.06;
    }
    if (consonantRatio > 0.55) {
      phrasingSlowdown += 0.05;
    }
    const baseDuration = clamp(voiceConfig.qwen.speedMs, 45, 220) * 1.12 * phrasingSlowdown;
    const plan: SynthStep[] = [];

    prosody.forEach((item) => {
      if (item.type === 'space') {
        plan.push({ symbol: '_', durationMs: item.duration * 1000, pitchOffset: 0 });
      } else {
        plan.push({
          symbol: item.symbol,
          durationMs: baseDuration * item.durationMul,
          pitchOffset: item.pitchOffset,
        });
      }
    });

    return plan;
  }

  public estimateDurationMs(text: string, voiceConfig: NarratorVoiceConfig): number {
    const params = this.resolveParams(voiceConfig);
    const plan = this.getSynthPlan(text, voiceConfig);
    if (!plan.length) return 0;

    let totalSamples = 0;
    for (let i = 0; i < plan.length; i += 1) {
      const current = plan[i];
      const currentSamples = Math.max(1, Math.round((current.durationMs / 1000) * SAMPLE_RATE));
      if (i === 0) {
        totalSamples += currentSamples;
        continue;
      }
      const previous = plan[i - 1];
      const previousSamples = Math.max(1, Math.round((previous.durationMs / 1000) * SAMPLE_RATE));
      const overlap = computeOverlapSamplesForBoundary(previous, current, params);
      const safeOverlap = Math.max(0, Math.min(overlap, previousSamples, currentSamples));
      totalSamples += currentSamples - safeOverlap;
    }

    return Math.max(0, Math.round((totalSamples / SAMPLE_RATE) * 1000));
  }

  public async play(options: PlayQwenFormantNarrationOptions): Promise<NarratorPlaybackHandle> {
    const text = normalizeText(options.text);
    if (!text) {
      return {
        durationMs: 0,
        stop: () => undefined,
        unload: () => undefined,
        finished: Promise.resolve(),
      };
    }

    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const params = this.resolveParams(options.voiceConfig);
    const structured = toPhonemes(text);
    const wordCount = structured.filter((item) => item.type === 'word').length;
    const clarityMode = wordCount >= LONG_TEXT_CLARITY_WORD_THRESHOLD;
    const effectiveParams: QwenRenderParams = clarityMode
      ? {
        ...params,
        jitter: params.jitter * 0.45,
        vowelGlitch: params.vowelGlitch * 0.35,
        transitionMul: params.transitionMul * 0.82,
      }
      : params;
    const seed = hashString(
      `${text}|${options.voiceConfig.qwen.persona}|${options.voiceConfig.qwen.pitchMul.toFixed(3)}|${options.voiceConfig.qwen.speedMs.toFixed(0)}|${options.voiceConfig.qwen.brightness.toFixed(3)}|${options.voiceConfig.qwen.volume.toFixed(3)}|${options.voiceConfig.qwen.jitter.toFixed(4)}|${options.voiceConfig.qwen.transitionMul.toFixed(3)}|${options.voiceConfig.qwen.vowelGlitch.toFixed(3)}`,
    );
    const random = seededRandom(seed);

    const plan = this.getSynthPlan(text, options.voiceConfig);
    const activeSources = new Set<AudioBufferSourceNode>();
    let phaseCursor = 0;
    const renderedBuffers: Float32Array[] = [];
    const renderedSteps: SynthStep[] = [];
    let trimmedPhonemeCount = 0;
    let droppedPhonemeCount = 0;

    for (const step of plan) {
      if (step.symbol === '_') {
        const silenceSamples = Math.max(1, Math.round((step.durationMs / 1000) * SAMPLE_RATE));
        renderedBuffers.push(new Float32Array(silenceSamples));
        renderedSteps.push(step);
        continue;
      }

      const dependsOnPhase = isPhaseDependentSymbol(step.symbol);
      const cacheKey = `${SYNTH_CACHE_VERSION}|${options.voiceConfig.qwen.persona}|${step.symbol}|${Math.round(step.durationMs)}|${step.pitchOffset.toFixed(3)}|${params.baseFreq.toFixed(2)}|${params.brightness.toFixed(2)}|${params.volume.toFixed(2)}|${params.jitter.toFixed(3)}`;
      let audioBuffer = dependsOnPhase ? null : this.cache.get(cacheKey) ?? null;
      let renderedPhaseOut = phaseCursor;

      if (!audioBuffer) {
        const rendered = await renderPhonemeBuffer(step.symbol, step.durationMs, effectiveParams, step.pitchOffset, random, phaseCursor);
        if (rendered) {
          audioBuffer = rendered.buffer;
          renderedPhaseOut = rendered.phaseOut;
          if (!dependsOnPhase) {
            this.cache.set(cacheKey, audioBuffer);
            this.trimCache();
          }
        }
      }

      if (!audioBuffer) {
        const fallbackSamples = Math.max(1, Math.round((step.durationMs / 1000) * SAMPLE_RATE));
        renderedBuffers.push(new Float32Array(fallbackSamples));
        renderedSteps.push(step);
        continue;
      }

      phaseCursor = renderedPhaseOut;
      const rawPhoneme = new Float32Array(audioBuffer.getChannelData(0));
      const shouldTrim = !isConsonantSymbol(step.symbol);
      const trimmedPhoneme = shouldTrim ? trimRealSilence(rawPhoneme, TRIM_THRESHOLD) : rawPhoneme;
      if (trimmedPhoneme.length === 0) {
        droppedPhonemeCount += 1;
        continue;
      }
      if (shouldTrim && trimmedPhoneme.length < rawPhoneme.length) {
        trimmedPhonemeCount += 1;
      }
      renderedBuffers.push(applyEdgeFade(trimmedPhoneme));
      renderedSteps.push(step);
    }

    if (!renderedBuffers.length) {
      return {
        durationMs: 0,
        stop: () => undefined,
        unload: () => undefined,
        finished: Promise.resolve(),
      };
    }

    const requestedOverlaps: number[] = [];
    for (let i = 0; i < renderedSteps.length - 1; i += 1) {
      requestedOverlaps.push(computeOverlapSamplesForBoundary(renderedSteps[i], renderedSteps[i + 1], effectiveParams));
    }

    const effectiveOverlaps: number[] = [];
    const nonSilenceEffectiveOverlaps: number[] = [];
    let nonSilenceBoundaryMaxJump = 0;
    for (let i = 1; i < renderedBuffers.length; i += 1) {
      const prev = renderedBuffers[i - 1];
      const curr = renderedBuffers[i];
      const requested = requestedOverlaps[i - 1] ?? 0;
      const effective = Math.max(0, Math.min(requested, prev.length, curr.length));
      effectiveOverlaps.push(effective);

      const prevStep = renderedSteps[i - 1];
      const currStep = renderedSteps[i];
      if (prevStep.symbol !== '_' && currStep.symbol !== '_') {
        nonSilenceEffectiveOverlaps.push(effective);
        const tail = prev[prev.length - 1] ?? 0;
        const head = curr[0] ?? 0;
        nonSilenceBoundaryMaxJump = Math.max(nonSilenceBoundaryMaxJump, Math.abs(tail - head));
      }
    }

    const mixedRaw = removeDcOffset(strictOverlapAdd(renderedBuffers, requestedOverlaps));
    const prePeak = computePeak(mixedRaw);
    const mixedPreNormalized = applyOnePoleLowPass(constrainSampleDelta(mixedRaw, POST_MIX_MAX_DELTA), POST_MIX_LOW_PASS_HZ);
    const mixedNormalized = normalizeToPeak(mixedPreNormalized, MIX_TARGET_PEAK);
    const mixed = normalizeToPeak(
      applyOnePoleLowPass(constrainSampleDelta(mixedNormalized, POST_NORMALIZE_MAX_DELTA), POST_NORMALIZE_LOW_PASS_HZ),
      MIX_TARGET_PEAK,
    );
    const postPeak = computePeak(mixed);

    const overlapMean = effectiveOverlaps.length
      ? Math.round(effectiveOverlaps.reduce((sum, value) => sum + value, 0) / effectiveOverlaps.length)
      : 0;
    const overlapMin = effectiveOverlaps.length ? Math.min(...effectiveOverlaps) : 0;
    const overlapMax = effectiveOverlaps.length ? Math.max(...effectiveOverlaps) : 0;
    const nonSilenceOverlapMin = nonSilenceEffectiveOverlaps.length ? Math.min(...nonSilenceEffectiveOverlaps) : 0;

    console.info('[qwen-runtime-mix]', {
      synthCacheVersion: SYNTH_CACHE_VERSION,
      contextualApproximantsEnabled: ENABLE_CONTEXTUAL_APPROXIMANTS,
      clarityMode,
      effectiveJitter: Number(effectiveParams.jitter.toFixed(4)),
      effectiveVowelGlitch: Number(effectiveParams.vowelGlitch.toFixed(4)),
      effectiveTransitionMul: Number(effectiveParams.transitionMul.toFixed(4)),
      phonemesPlanned: plan.filter((step) => step.symbol !== '_').length,
      renderedSteps: renderedSteps.length,
      trimmedPhonemeCount,
      droppedPhonemeCount,
      overlapMsBase: BASE_OVERLAP_MS,
      overlapSamplesMax: MAX_OVERLAP_SAMPLES,
      overlapSamplesMean: overlapMean,
      overlapSamplesMin: overlapMin,
      overlapSamplesObservedMax: overlapMax,
      overlapSamplesMinNonSilence: nonSilenceOverlapMin,
      nonSilenceBoundaryMaxJump: Number(nonSilenceBoundaryMaxJump.toFixed(4)),
      postMixLowPassHz: POST_MIX_LOW_PASS_HZ,
      postMixMaxDelta: POST_MIX_MAX_DELTA,
      postNormalizeLowPassHz: POST_NORMALIZE_LOW_PASS_HZ,
      postNormalizeMaxDelta: POST_NORMALIZE_MAX_DELTA,
      prePeakDbfs: Number(toDbfs(prePeak).toFixed(2)),
      postPeakDbfs: Number(toDbfs(postPeak).toFixed(2)),
      targetPeakDbfs: Number(toDbfs(MIX_TARGET_PEAK).toFixed(2)),
    });

    const durationMs = Math.max(0, Math.round((mixed.length / SAMPLE_RATE) * 1000));
    const startAt = context.currentTime + (AUDIO_START_DELAY_MS / 1000);

    const playbackBuffer = context.createBuffer(1, Math.max(1, mixed.length), SAMPLE_RATE);
    playbackBuffer.getChannelData(0).set(mixed.length ? mixed : new Float32Array([0]));

    const source = context.createBufferSource();
    source.buffer = playbackBuffer;

    const outputGain = context.createGain();
    outputGain.gain.value = Math.pow(10, OUTPUT_HEADROOM_DB / 20);
    source.connect(outputGain);
    outputGain.connect(context.destination);

    source.start(startAt);
    source.stop(startAt + (durationMs / 1000));
    activeSources.add(source);

    source.onended = () => {
      activeSources.delete(source);
      source.disconnect();
      outputGain.disconnect();
    };

    let resolveFinished: () => void = () => undefined;
    let isDone = false;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const resolveOnce = () => {
      if (isDone) return;
      isDone = true;
      resolveFinished();
    };

    const timeoutId = window.setTimeout(() => {
      resolveOnce();
    }, Math.max(0, durationMs + AUDIO_START_DELAY_MS + 60));

    const stop = () => {
      activeSources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // ignore double stop
        }
        source.disconnect();
      });
      activeSources.clear();
      window.clearTimeout(timeoutId);
      resolveOnce();
    };

    return {
      durationMs,
      stop,
      unload: stop,
      finished,
    };
  }
}

const qwenFormantEngine = new QwenFormantEngine();

/**
 * Plays narration using the Qwen-inspired formant engine.
 */
export async function playQwenFormantNarration(options: PlayQwenFormantNarrationOptions): Promise<NarratorPlaybackHandle> {
  return qwenFormantEngine.play(options);
}

/**
 * Estimates duration for the Qwen-inspired narrator mode.
 */
export function estimateQwenFormantNarrationDurationMs(text: string, voiceConfig: NarratorVoiceConfig): number {
  return qwenFormantEngine.estimateDurationMs(text, voiceConfig);
}
