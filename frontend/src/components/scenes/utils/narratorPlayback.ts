import { Howl } from 'howler';
import {
  estimateTomodachiFormantNarrationDurationMs,
  playTomodachiFormantNarration,
} from './narrator/tomodachiFormantEngine';
import {
  estimateQwenFormantNarrationDurationMs,
  playQwenFormantNarration,
} from './narrator/qwenFormantEngine';
import {
  estimateTomodachiSampleNarrationDurationMs,
  playTomodachiSampleNarration,
} from './narrator/tomodachiSampleEngine';

export type NarratorVoiceMode = 'retroBeep' | 'animalese' | 'tomodachi' | 'qwenFormant';
export type NarratorVoiceTarget = 'main' | 'projection' | 'both';
export type NarratorTomodachiSampleSet = 'classic' | 'bright' | 'soft';
export type NarratorQwenPersona = 'male' | 'female' | 'child' | 'robot';

export interface NarratorTomodachiConfig {
  sampleSet: NarratorTomodachiSampleSet;
  consonantDensity: number;
  humanize: number;
}

export interface NarratorQwenConfig {
  persona: NarratorQwenPersona;
  pitchMul: number;
  speedMs: number;
  brightness: number;
  volume: number;
  jitter: number;
  transitionMul: number;
  vowelGlitch: number;
}

export interface NarratorVoiceConfig {
  mode: NarratorVoiceMode;
  speed: number;
  pitchRange: number;
  tomodachi: NarratorTomodachiConfig;
  qwen: NarratorQwenConfig;
}

export interface NarratorPlaybackOptions {
  text: string;
  voiceConfig?: Partial<NarratorVoiceConfig>;
  locale?: string;
}

export interface NarratorPlaybackHandle {
  durationMs: number;
  stop: () => void;
  unload: () => void;
  finished: Promise<void>;
}

type SynthSegment =
  | { kind: 'tone'; char: string; durationMs: number; frequencyHz: number; intensity: number; accent?: boolean }
  | { kind: 'pause'; durationMs: number };

type CacheEntry = {
  howl: Howl;
  objectUrl: string;
  durationMs: number;
  lastUsedAtMs: number;
};

type LocaleVoiceProfile = {
  localeKey: 'es' | 'en' | 'default';
  baseFrequencyScale: number;
  punctuationScale: number;
  pauseScale: number;
  energyScale: number;
};

const DEFAULT_VOICE_CONFIG: NarratorVoiceConfig = {
  mode: 'retroBeep',
  speed: 1,
  pitchRange: 8,
  tomodachi: {
    sampleSet: 'classic',
    consonantDensity: 1,
    humanize: 0.65,
  },
  qwen: {
    persona: 'male',
    pitchMul: 1,
    speedMs: 90,
    brightness: 1,
    volume: 0.7,
    jitter: 0.08,
    transitionMul: 0.3,
    vowelGlitch: 0.28,
  },
};

const DEFAULT_VOICE_TARGET: NarratorVoiceTarget = 'projection';
const SAMPLE_RATE = 24000;
const MAX_CACHE_ENTRIES = 8;
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
const ACCENTED_VOWELS = new Set(['á', 'é', 'í', 'ó', 'ú', 'ü']);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getQwenDefaultsForPersona = (persona: NarratorQwenPersona): NarratorQwenConfig => {
  if (persona === 'female') {
    return { persona, pitchMul: 1.3, speedMs: 90, brightness: 1.3, volume: 0.68, jitter: 0.08, transitionMul: 0.34, vowelGlitch: 0.3 };
  }
  if (persona === 'child') {
    return { persona, pitchMul: 1.6, speedMs: 90, brightness: 1.5, volume: 0.66, jitter: 0.1, transitionMul: 0.38, vowelGlitch: 0.34 };
  }
  if (persona === 'robot') {
    return { persona, pitchMul: 1, speedMs: 90, brightness: 0.6, volume: 0.72, jitter: 0.02, transitionMul: 0.14, vowelGlitch: 0.08 };
  }
  return { persona: 'male', pitchMul: 1, speedMs: 90, brightness: 1, volume: 0.7, jitter: 0.08, transitionMul: 0.3, vowelGlitch: 0.28 };
};

const normalizeVoiceConfig = (voiceConfig?: Partial<NarratorVoiceConfig>): NarratorVoiceConfig => {
  const rawTomodachi = voiceConfig?.tomodachi;
  const rawQwen = voiceConfig?.qwen;
  const sampleSet =
    rawTomodachi?.sampleSet === 'classic' || rawTomodachi?.sampleSet === 'bright' || rawTomodachi?.sampleSet === 'soft'
      ? rawTomodachi.sampleSet
      : DEFAULT_VOICE_CONFIG.tomodachi.sampleSet;
  const qwenPersona =
    rawQwen?.persona === 'male' || rawQwen?.persona === 'female' || rawQwen?.persona === 'child' || rawQwen?.persona === 'robot'
      ? rawQwen.persona
      : DEFAULT_VOICE_CONFIG.qwen.persona;
  const qwenDefaults = getQwenDefaultsForPersona(qwenPersona);
  return {
    mode: voiceConfig?.mode === 'animalese' || voiceConfig?.mode === 'tomodachi' || voiceConfig?.mode === 'retroBeep' || voiceConfig?.mode === 'qwenFormant'
      ? voiceConfig.mode
      : DEFAULT_VOICE_CONFIG.mode,
    speed: Number.isFinite(Number(voiceConfig?.speed))
      ? clamp(Number(voiceConfig?.speed), 0.25, 3)
      : DEFAULT_VOICE_CONFIG.speed,
    pitchRange: Number.isFinite(Number(voiceConfig?.pitchRange))
      ? clamp(Number(voiceConfig?.pitchRange), 0, 24)
      : DEFAULT_VOICE_CONFIG.pitchRange,
    tomodachi: {
      sampleSet,
      consonantDensity: Number.isFinite(Number(rawTomodachi?.consonantDensity))
        ? clamp(Number(rawTomodachi?.consonantDensity), 0, 1)
        : DEFAULT_VOICE_CONFIG.tomodachi.consonantDensity,
      humanize: Number.isFinite(Number(rawTomodachi?.humanize))
        ? clamp(Number(rawTomodachi?.humanize), 0, 1)
        : DEFAULT_VOICE_CONFIG.tomodachi.humanize,
    },
    qwen: {
      persona: qwenPersona,
      pitchMul: Number.isFinite(Number(rawQwen?.pitchMul))
        ? clamp(Number(rawQwen?.pitchMul), 0.5, 2.5)
        : qwenDefaults.pitchMul,
      speedMs: Number.isFinite(Number(rawQwen?.speedMs))
        ? clamp(Number(rawQwen?.speedMs), 30, 200)
        : qwenDefaults.speedMs,
      brightness: Number.isFinite(Number(rawQwen?.brightness))
        ? clamp(Number(rawQwen?.brightness), 0.3, 3)
        : qwenDefaults.brightness,
      volume: Number.isFinite(Number(rawQwen?.volume))
        ? clamp(Number(rawQwen?.volume), 0.1, 1)
        : qwenDefaults.volume,
      jitter: Number.isFinite(Number(rawQwen?.jitter))
        ? clamp(Number(rawQwen?.jitter), 0, 0.3)
        : qwenDefaults.jitter,
      transitionMul: Number.isFinite(Number(rawQwen?.transitionMul))
        ? clamp(Number(rawQwen?.transitionMul), 0, 0.8)
        : qwenDefaults.transitionMul,
        vowelGlitch: Number.isFinite(Number(rawQwen?.vowelGlitch))
          ? clamp(Number(rawQwen?.vowelGlitch), 0, 1)
          : qwenDefaults.vowelGlitch,
    },
  };
};

const normalizeText = (text: string): string => {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeVoiceTarget = (value: unknown): NarratorVoiceTarget => {
  if (value === 'main' || value === 'projection' || value === 'both') {
    return value;
  }
  return DEFAULT_VOICE_TARGET;
};

const resolveLocaleVoiceProfile = (locale?: string): LocaleVoiceProfile => {
  const normalized = String(locale ?? '').toLowerCase();
  if (normalized.startsWith('es')) {
    return {
      localeKey: 'es',
      baseFrequencyScale: 0.94,
      punctuationScale: 1.24,
      pauseScale: 1.12,
      energyScale: 1.06,
    };
  }
  if (normalized.startsWith('en')) {
    return {
      localeKey: 'en',
      baseFrequencyScale: 1,
      punctuationScale: 1,
      pauseScale: 1,
      energyScale: 1,
    };
  }
  return {
    localeKey: 'default',
    baseFrequencyScale: 1,
    punctuationScale: 1,
    pauseScale: 1,
    energyScale: 1,
  };
};

const isAccentChar = (char: string): boolean => ACCENTED_VOWELS.has(char.toLowerCase());

const createSeed = (text: string, config: NarratorVoiceConfig, localeKey?: string): string => {
  return `${config.mode}|${config.speed.toFixed(2)}|${config.pitchRange.toFixed(2)}|${config.tomodachi.sampleSet}|${config.tomodachi.consonantDensity.toFixed(2)}|${config.tomodachi.humanize.toFixed(2)}|${config.qwen.persona}|${config.qwen.pitchMul.toFixed(2)}|${config.qwen.speedMs.toFixed(0)}|${config.qwen.brightness.toFixed(2)}|${config.qwen.volume.toFixed(2)}|${config.qwen.jitter.toFixed(3)}|${config.qwen.transitionMul.toFixed(2)}|${config.qwen.vowelGlitch.toFixed(2)}|${localeKey ?? 'default'}|${text}`;
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

const charBaseFrequency = (char: string): number => {
  const normalized = char.toLowerCase();
  if (VOWELS.has(normalized)) {
    switch (normalized) {
      case 'a': return 280;
      case 'e': return 320;
      case 'i': return 360;
      case 'o': return 300;
      case 'u': return 250;
      case 'y': return 340;
      default: return 300;
    }
  }
  if (/[0-9]/.test(normalized)) {
    return 240 + (Number(normalized) * 12);
  }
  if (/[bcdfg]/.test(normalized)) return 210;
  if (/[hjklmnpqrstvwxz]/.test(normalized)) return 190;
  return 230;
};

const charIntensity = (char: string): number => {
  const normalized = char.toLowerCase();
  if (VOWELS.has(normalized)) return 1;
  if (/[0-9]/.test(normalized)) return 0.8;
  if (/[^a-z0-9]/.test(normalized)) return 0.55;
  return 0.72;
};

const punctuationPauseMs = (char: string): number => {
  switch (char) {
    case ',': return 180;
    case ';': return 210;
    case ':': return 220;
    case '.': return 340;
    case '!': return 300;
    case '?': return 320;
    case '\n': return 260;
    default: return 0;
  }
};

const baseLetterDurationMs = (config: NarratorVoiceConfig): number => {
  switch (config.mode) {
    case 'retroBeep': return 78 / config.speed;
    case 'animalese': return 86 / config.speed;
    case 'tomodachi': return 82 / config.speed;
    case 'qwenFormant': return 90 / config.speed;
    default: return 80 / config.speed;
  }
};

const spacePauseMs = (config: NarratorVoiceConfig): number => {
  switch (config.mode) {
    case 'retroBeep': return 90 / config.speed;
    case 'animalese': return 105 / config.speed;
    case 'tomodachi': return 100 / config.speed;
    case 'qwenFormant': return 112 / config.speed;
    default: return 95 / config.speed;
  }
};

const buildSegments = (text: string, config: NarratorVoiceConfig, localeProfile: LocaleVoiceProfile): SynthSegment[] => {
  const normalized = normalizeText(text);
  const seed = hashString(createSeed(normalized, config, localeProfile.localeKey));
  const random = seededRandom(seed);
  const segments: SynthSegment[] = [];
  const sourceChars = normalized.split('');
  const endsWithQuestionMark = normalized.trimEnd().endsWith('?');
  let lastToneIndex = -1;

  for (const char of sourceChars) {
    if (char === ' ') {
      segments.push({ kind: 'pause', durationMs: spacePauseMs(config) * localeProfile.pauseScale });
      continue;
    }

    const pauseMs = punctuationPauseMs(char) * localeProfile.punctuationScale;
    if (pauseMs > 0) {
      segments.push({ kind: 'pause', durationMs: pauseMs });
      continue;
    }

    if (!/[\p{L}\p{N}]/u.test(char)) {
      continue;
    }

    const lower = char.toLowerCase();
    const baseFrequency = charBaseFrequency(lower);
    const intensity = charIntensity(lower);
    const pitchJitter = (random() * 2 - 1) * clamp(config.pitchRange, 0, 24) * (config.mode === 'tomodachi' ? 7.5 : config.mode === 'animalese' ? 5.2 : config.mode === 'qwenFormant' ? 4.4 : 3.4);
    const accentBoost = isAccentChar(lower) ? Math.max(1.08, 1 + (config.pitchRange / 100) * 0.8) : 1;
    const durationMs = baseLetterDurationMs(config) * (VOWELS.has(lower) ? 1.25 : 0.95);

    segments.push({
      kind: 'tone',
      char: lower,
      durationMs,
      frequencyHz: Math.max(80, (baseFrequency + pitchJitter) * localeProfile.baseFrequencyScale),
      intensity: Math.min(1.2, intensity * localeProfile.energyScale),
      accent: accentBoost > 1,
    });
    lastToneIndex = segments.length - 1;
  }

  if (config.mode === 'tomodachi' && endsWithQuestionMark && lastToneIndex >= 0) {
    const last = segments[lastToneIndex];
    if (last.kind === 'tone') {
      last.frequencyHz *= 1.22;
      last.durationMs *= 0.9;
      last.intensity = Math.min(1.2, last.intensity + 0.15);
    }
  }

  if (config.mode === 'animalese') {
    for (const segment of segments) {
      if (segment.kind !== 'tone') continue;
      if (VOWELS.has(segment.char)) {
        segment.frequencyHz *= 1.05;
        segment.durationMs *= 1.1;
      } else {
        segment.frequencyHz *= 0.95;
      }
    }
  }

  return segments;
};

const renderSegmentsToBuffer = (
  segments: SynthSegment[],
  config: NarratorVoiceConfig,
  localeProfile: LocaleVoiceProfile,
): { buffer: Float32Array; durationMs: number } => {
  const totalDurationMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0);
  const totalSamples = Math.max(1, Math.round((totalDurationMs / 1000) * SAMPLE_RATE));
  const buffer = new Float32Array(totalSamples);
  const seed = hashString(createSeed(segments.map((segment) => (segment.kind === 'tone' ? segment.char : '_')).join(''), config, localeProfile.localeKey));
  const random = seededRandom(seed ^ 0x9e3779b9);

  let cursorSample = 0;
  for (const segment of segments) {
    const segmentSamples = Math.max(1, Math.round((segment.durationMs / 1000) * SAMPLE_RATE));
    if (segment.kind === 'pause') {
      cursorSample += segmentSamples;
      continue;
    }

    const attackSamples = Math.max(1, Math.round((config.mode === 'retroBeep' ? 0.0028 : 0.007) * SAMPLE_RATE));
    const releaseSamples = Math.max(1, Math.round((config.mode === 'retroBeep' ? 0.012 : 0.029) * SAMPLE_RATE));
    const vibratoRate = config.mode === 'tomodachi' ? 7.2 : config.mode === 'animalese' ? 3.6 : 1.8;
    const vibratoDepth = config.mode === 'tomodachi'
      ? 0.05 + (config.pitchRange / 70)
      : config.mode === 'animalese'
        ? 0.028 + (config.pitchRange / 110)
        : 0.006 + (config.pitchRange / 220);
    const detuneBase = config.pitchRange * (segment.accent ? 1.4 : 1);

    for (let i = 0; i < segmentSamples && cursorSample + i < buffer.length; i += 1) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, i / attackSamples);
      const release = Math.min(1, (segmentSamples - i) / releaseSamples);
      const envelope = Math.min(attack, release);
      const vibrato = Math.sin(t * Math.PI * 2 * vibratoRate) * vibratoDepth;
      const frequency = segment.frequencyHz * (1 + vibrato) * (1 + (detuneBase / 120));
      const phase = t * Math.PI * 2 * frequency;

      let sample = 0;
      if (config.mode === 'retroBeep') {
        const square = Math.sign(Math.sin(phase));
        const lowSine = Math.sin(phase * 0.5) * 0.2;
        sample = (square * 0.72) + lowSine;
      } else if (config.mode === 'animalese') {
        const body = (Math.sin(phase) * 0.46) + (Math.sin(phase * 2.05) * 0.34);
        const airy = Math.sin(phase * 0.5) * 0.16;
        const consonantNoise = (random() - 0.5) * 0.06;
        sample = body + airy + consonantNoise;
      } else {
        const melody = Math.sin(phase * 0.92) * 0.46 + Math.sin(phase * 1.86) * 0.28;
        const overtone = Math.sin(phase * 3.02) * 0.14;
        const sparkle = (random() - 0.5) * 0.1;
        sample = melody + overtone + sparkle;
      }

      const softness = segment.char === 's' || segment.char === 'f' || segment.char === 'z' ? 0.7 : 1;
      const modeGain = config.mode === 'retroBeep' ? 0.82 : config.mode === 'animalese' ? 0.9 : 1;
      buffer[cursorSample + i] = clamp(sample * envelope * segment.intensity * softness * modeGain * localeProfile.energyScale, -1, 1);
    }

    cursorSample += segmentSamples;
  }

  return { buffer, durationMs: totalDurationMs };
};

const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = clamp(sample, -1, 1);
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

class NarratorPlaybackManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly activeStops = new Set<() => void>();

  private trimCache(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) return;
    const ordered = [...this.cache.entries()].sort((left, right) => left[1].lastUsedAtMs - right[1].lastUsedAtMs);
    while (ordered.length > MAX_CACHE_ENTRIES) {
      const [key, entry] = ordered.shift() as [string, CacheEntry];
      entry.howl.unload();
      URL.revokeObjectURL(entry.objectUrl);
      this.cache.delete(key);
    }
  }

  public stopAll(): void {
    for (const stop of [...this.activeStops]) {
      try {
        stop();
      } catch {
        // ignore
      }
    }
    this.activeStops.clear();
  }

  public async play(options: NarratorPlaybackOptions): Promise<NarratorPlaybackHandle> {
    const text = normalizeText(options.text);
    if (!text) {
      return {
        durationMs: 0,
        stop: () => undefined,
        unload: () => undefined,
        finished: Promise.resolve(),
      };
    }
    const voiceConfig = normalizeVoiceConfig(options.voiceConfig);
    if (voiceConfig.mode === 'tomodachi') {
      try {
        return await playTomodachiFormantNarration({
          text,
          voiceConfig,
          locale: options.locale,
        });
      } catch {
        // Fallback to sample-based synthesis when formant synthesis fails.
      }
      try {
        return await playTomodachiSampleNarration({
          text,
          voiceConfig,
          locale: options.locale,
        });
      } catch {
        // Fallback to procedural synthesis if sample assets are missing.
      }
    }
    if (voiceConfig.mode === 'qwenFormant') {
      try {
        return await playQwenFormantNarration({
          text,
          voiceConfig,
          locale: options.locale,
        });
      } catch (error) {
        console.warn('[Narrator] qwenFormant playback failed; falling back to procedural mode.', error);
        // Fallback to procedural synthesis for runtime resilience.
      }
    }
    const localeProfile = resolveLocaleVoiceProfile(options.locale);
    const cacheKey = createSeed(text, voiceConfig, localeProfile.localeKey);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.lastUsedAtMs = Date.now();
      return this.playCachedEntry(cacheKey, cached);
    }

    const segments = buildSegments(text, voiceConfig, localeProfile);
    const rendered = renderSegmentsToBuffer(segments, voiceConfig, localeProfile);
    const blob = encodeWav(rendered.buffer, SAMPLE_RATE);
    const objectUrl = URL.createObjectURL(blob);

    const howl = new Howl({
      src: [objectUrl],
      format: ['wav'],
      preload: true,
      volume: 1,
      pool: 1,
      html5: false,
    });

    const entry: CacheEntry = {
      howl,
      objectUrl,
      durationMs: rendered.durationMs,
      lastUsedAtMs: Date.now(),
    };

    this.cache.set(cacheKey, entry);
    this.trimCache();

    return this.playCachedEntry(cacheKey, entry);
  }

  private playCachedEntry(cacheKey: string, entry: CacheEntry): NarratorPlaybackHandle {
    let soundId: number | null = null;
    let stopRequested = false;
    let resolveFinished: () => void = () => undefined;
    let isFinished = false;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const resolveOnce = () => {
      if (isFinished) return;
      isFinished = true;
      resolveFinished();
    };

    const onEnded = () => {
      cleanup();
      resolveOnce();
    };

    const onStopped = () => {
      cleanup();
      resolveOnce();
    };

    const cleanup = () => {
      if (soundId !== null) {
        entry.howl.off('end', onEnded, soundId);
        entry.howl.off('stop', onStopped, soundId);
      }
      this.activeStops.delete(stop);
    };

    const stop = () => {
      if (stopRequested) return;
      stopRequested = true;
      if (soundId !== null) {
        try {
          entry.howl.stop(soundId);
        } catch {
          // ignore
        }
      }
      cleanup();
      resolveOnce();
    };

    this.activeStops.add(stop);
    soundId = entry.howl.play();
    entry.howl.once('end', onEnded, soundId);
    entry.howl.once('stop', onStopped, soundId);

    return {
      durationMs: entry.durationMs,
      stop,
      unload: () => {
        stop();
        const cached = this.cache.get(cacheKey);
        if (cached) {
          cached.howl.unload();
          URL.revokeObjectURL(cached.objectUrl);
          this.cache.delete(cacheKey);
        }
      },
      finished,
    };
  }
}

const narratorPlaybackManager = new NarratorPlaybackManager();

/**
 * Estimates narration duration in milliseconds for scene timing.
 */
export function estimateNarrationDurationMs(text: string, voiceConfig?: Partial<NarratorVoiceConfig>): number {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return 0;
  const normalizedVoiceConfig = normalizeVoiceConfig(voiceConfig);
  if (normalizedVoiceConfig.mode === 'tomodachi') {
    const formantEstimate = estimateTomodachiFormantNarrationDurationMs(normalizedText, normalizedVoiceConfig);
    if (formantEstimate > 0) {
      return formantEstimate;
    }
    const estimate = estimateTomodachiSampleNarrationDurationMs(normalizedText, normalizedVoiceConfig);
    if (estimate > 0) {
      return estimate;
    }
  }
  if (normalizedVoiceConfig.mode === 'qwenFormant') {
    const estimate = estimateQwenFormantNarrationDurationMs(normalizedText, normalizedVoiceConfig);
    if (estimate > 0) {
      return estimate;
    }
  }
  const segments = buildSegments(normalizedText, normalizedVoiceConfig, resolveLocaleVoiceProfile(undefined));
  return Math.max(0, Math.round(segments.reduce((sum, segment) => sum + segment.durationMs, 0)));
}

/**
 * Starts narration playback with an optional cached synthesized clip.
 */
export async function playNarration(options: NarratorPlaybackOptions): Promise<NarratorPlaybackHandle> {
  return narratorPlaybackManager.play(options);
}

/**
 * Stops all active narrator playback instances.
 */
export function stopAllNarrationPlayback(): void {
  narratorPlaybackManager.stopAll();
}

/**
 * Resolves the scene voice config to a bounded, runtime-safe value.
 */
export function normalizeNarratorVoiceConfig(voiceConfig?: Partial<NarratorVoiceConfig>): NarratorVoiceConfig {
  return normalizeVoiceConfig(voiceConfig);
}

/**
 * Resolves narrator voice target to a valid value.
 */
export function normalizeNarratorVoiceTarget(value: unknown): NarratorVoiceTarget {
  return normalizeVoiceTarget(value);
}
