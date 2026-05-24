import type { NarratorPlaybackHandle, NarratorVoiceConfig } from '../narratorPlayback';

type PlayTomodachiFormantNarrationOptions = {
  text: string;
  voiceConfig: NarratorVoiceConfig;
  locale?: string;
};

type FormantPhoneme = {
  symbol: string;
  formants?: [number, number, number];
  class: 'vowel' | 'fricative' | 'nasal' | 'liquid' | 'plosive' | 'other';
};

type SynthToken =
  | { kind: 'pause'; durationMs: number }
  | { kind: 'phoneme'; phoneme: FormantPhoneme; durationMs: number; pitchMul: number };

type FormantIntelligibilityProfile = {
  basePhonemeMs: number;
  overlap: number;
  qualityScale: number;
  fricativeGain: number;
  plosiveGain: number;
};

const VOWEL_FORMANTS: Record<string, [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

const AUDIO_START_DELAY_MS = 40;
const DEFAULT_OVERLAP = 0.74;
const DEFAULT_BASE_PHONEME_MS = 96;
const SAMPLE_RATE = 24000;
const MAX_CACHE_ENTRIES = 180;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

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

const normalizeText = (text: string): string => String(text ?? '').replace(/\s+/g, ' ').trim();

const mapLocale = (locale?: string): 'es' | 'en' | 'default' => {
  const normalized = String(locale ?? '').toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('en')) return 'en';
  return 'default';
};

const getIntelligibilityProfile = (sampleSet: NarratorVoiceConfig['tomodachi']['sampleSet']): FormantIntelligibilityProfile => {
  if (sampleSet === 'soft') {
    return {
      basePhonemeMs: 92,
      overlap: 0.78,
      qualityScale: 0.98,
      fricativeGain: 0.9,
      plosiveGain: 0.88,
    };
  }
  if (sampleSet === 'bright') {
    return {
      basePhonemeMs: 104,
      overlap: 0.68,
      qualityScale: 1.05,
      fricativeGain: 1.2,
      plosiveGain: 1.1,
    };
  }
  return {
    basePhonemeMs: DEFAULT_BASE_PHONEME_MS,
    overlap: DEFAULT_OVERLAP,
    qualityScale: 1,
    fricativeGain: 1,
    plosiveGain: 1,
  };
};

const buildFormantPhoneme = (symbol: string): FormantPhoneme => {
  if (VOWEL_FORMANTS[symbol]) {
    return { symbol, class: 'vowel', formants: VOWEL_FORMANTS[symbol] };
  }

  if (['s', 'f', 'ch', 'j', 'z', 'x', 'h'].includes(symbol)) {
    return { symbol, class: 'fricative' };
  }

  if (['m', 'n'].includes(symbol)) {
    return { symbol, class: 'nasal' };
  }

  if (['l', 'r', 'y', 'll', 'w'].includes(symbol)) {
    return { symbol, class: 'liquid' };
  }

  if (['p', 't', 'k', 'c', 'q', 'b', 'd', 'g'].includes(symbol)) {
    return { symbol, class: 'plosive' };
  }

  if (/^[a-z]$/.test(symbol)) {
    return { symbol, class: 'liquid' };
  }

  return { symbol, class: 'other' };
};

const toPhonemes = (text: string): string[] => {
  const normalized = normalizeText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ch/g, '1')
    .replace(/ll/g, '2')
    .replace(/rr/g, 'r')
    .replace(/qu/g, 'k')
    .replace(/ce/g, 'se')
    .replace(/ci/g, 'si')
    .replace(/ge/g, 'je')
    .replace(/gi/g, 'ji');

  const phonemes: string[] = [];
  for (const char of normalized) {
    if (char === '1') {
      phonemes.push('ch');
      continue;
    }
    if (char === '2') {
      phonemes.push('ll');
      continue;
    }
    if (char === ' ') {
      phonemes.push('PAUSE_WORD');
      continue;
    }
    if (char === ',') {
      phonemes.push('PAUSE_SHORT');
      continue;
    }
    if (char === ';' || char === ':') {
      phonemes.push('PAUSE_MEDIUM');
      continue;
    }
    if (char === '.' || char === '!' || char === '?') {
      phonemes.push('PAUSE_LONG');
      continue;
    }
    if (/[a-z]/.test(char)) {
      phonemes.push(char);
    }
  }
  return phonemes;
};

const getAudioContext = (): AudioContext => {
  const maybeWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const contextCtor = window.AudioContext ?? maybeWindow.webkitAudioContext;
  if (!contextCtor) {
    throw new Error('AudioContext not supported in this environment.');
  }
  return new contextCtor();
};

/**
 * Synthesizes one phoneme into an audio buffer using formant-inspired filters.
 */
const generatePhonemeBuffer = async (
  phoneme: FormantPhoneme,
  durationMs: number,
  pitchMul: number,
  qualityScale: number,
  profile: FormantIntelligibilityProfile,
): Promise<AudioBuffer | null> => {
  const durationSec = Math.max(0.02, durationMs / 1000);
  const frameCount = Math.max(1, Math.round(SAMPLE_RATE * durationSec));
  const offlineCtx = new OfflineAudioContext(1, frameCount, SAMPLE_RATE);

  const masterGain = offlineCtx.createGain();
  const attack = Math.min(0.012, durationSec * 0.18);
  const release = Math.min(0.02, durationSec * 0.24);
  masterGain.gain.setValueAtTime(0, offlineCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(1, offlineCtx.currentTime + attack);
  masterGain.gain.setValueAtTime(1, Math.max(offlineCtx.currentTime + attack, durationSec - release));
  masterGain.gain.linearRampToValueAtTime(0, durationSec);
  masterGain.connect(offlineCtx.destination);

  const baseF0 = 140 * clamp(pitchMul, 0.55, 2.3);

  if (phoneme.class === 'vowel' && phoneme.formants) {
    const source = offlineCtx.createOscillator();
    source.type = 'sawtooth';
    source.frequency.value = baseF0;

    const gains = [1.0, 0.56, 0.18];
    phoneme.formants.forEach((freq, index) => {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq * qualityScale;
      filter.Q.value = 9.2 + (profile.qualityScale - 1) * 4;

      const gain = offlineCtx.createGain();
      gain.gain.value = gains[index];

      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
    });

    source.start();
    source.stop(durationSec);
    return offlineCtx.startRendering();
  }

  if (phoneme.class === 'fricative') {
    const noiseBuffer = offlineCtx.createBuffer(1, frameCount, SAMPLE_RATE);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2) - 1;
    }

    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'bandpass';
    if (phoneme.symbol === 's' || phoneme.symbol === 'z') {
      filter.frequency.value = 6000;
      filter.Q.value = 1;
    } else if (phoneme.symbol === 'f') {
      filter.frequency.value = 4200;
      filter.Q.value = 0.7;
    } else if (phoneme.symbol === 'ch' || phoneme.symbol === 'x') {
      filter.frequency.value = 3400;
      filter.Q.value = 2;
    } else {
      filter.frequency.value = 1700;
      filter.Q.value = 1;
    }
    noise.connect(filter);
    const fricativeGain = offlineCtx.createGain();
    fricativeGain.gain.value = profile.fricativeGain;
    filter.connect(fricativeGain);
    fricativeGain.connect(masterGain);
    noise.start();
    return offlineCtx.startRendering();
  }

  if (phoneme.class === 'nasal' || phoneme.class === 'liquid') {
    const osc = offlineCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = baseF0;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    if (['m', 'n'].includes(phoneme.symbol)) {
      filter.frequency.value = 320;
    } else if (phoneme.symbol === 'l') {
      filter.frequency.value = 860;
    } else if (['y', 'll'].includes(phoneme.symbol)) {
      filter.frequency.value = 1250;
    } else if (phoneme.symbol === 'r') {
      filter.frequency.value = 1550;
      const lfo = offlineCtx.createOscillator();
      lfo.frequency.value = 24;
      const lfoGain = offlineCtx.createGain();
      lfoGain.gain.value = 100;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      lfo.stop(durationSec);
    } else {
      filter.frequency.value = 1050;
    }

    osc.connect(filter);
    filter.connect(masterGain);
    osc.start();
    osc.stop(durationSec);
    return offlineCtx.startRendering();
  }

  if (phoneme.class === 'plosive') {
    const burstDurationSec = Math.min(durationSec, 0.06);
    const burstFrames = Math.max(1, Math.round(SAMPLE_RATE * burstDurationSec));
    const noiseBuffer = offlineCtx.createBuffer(1, burstFrames, SAMPLE_RATE);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2) - 1;
    }

    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'bandpass';
    if (phoneme.symbol === 't' || phoneme.symbol === 'd') {
      filter.frequency.value = 3000;
    } else if (['k', 'c', 'q', 'g'].includes(phoneme.symbol)) {
      filter.frequency.value = 1500;
    } else {
      filter.frequency.value = 900;
    }

    const burstGain = offlineCtx.createGain();
    burstGain.gain.setValueAtTime(1, offlineCtx.currentTime);
    burstGain.gain.exponentialRampToValueAtTime(0.01, burstDurationSec);

    noise.connect(filter);
    filter.connect(burstGain);
    const plosiveGain = offlineCtx.createGain();
    plosiveGain.gain.value = profile.plosiveGain;
    burstGain.connect(plosiveGain);
    plosiveGain.connect(masterGain);
    noise.start();

    if (['b', 'd', 'g'].includes(phoneme.symbol)) {
      const voice = offlineCtx.createOscillator();
      voice.type = 'sine';
      voice.frequency.value = 100 * clamp(pitchMul, 0.65, 1.8);
      const voiceGain = offlineCtx.createGain();
      voiceGain.gain.value = 0.45;
      voice.connect(voiceGain);
      voiceGain.connect(masterGain);
      voice.start();
      voice.stop(burstDurationSec);
    }

    return offlineCtx.startRendering();
  }

  return null;
};

class TomodachiFormantEngine {
  private audioContext: AudioContext | null = null;
  private readonly phonemeCache = new Map<string, AudioBuffer>();

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = getAudioContext();
    }
    return this.audioContext;
  }

  private trimCache(): void {
    if (this.phonemeCache.size <= MAX_CACHE_ENTRIES) return;
    const keys = [...this.phonemeCache.keys()];
    while (keys.length > MAX_CACHE_ENTRIES) {
      const key = keys.shift();
      if (!key) continue;
      this.phonemeCache.delete(key);
    }
  }

  private buildTokens(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): SynthToken[] {
    const localeKey = mapLocale(locale);
    const phonemes = toPhonemes(text);
    const profile = getIntelligibilityProfile(voiceConfig.tomodachi.sampleSet);
    const stepDurationMs = clamp(profile.basePhonemeMs / voiceConfig.speed, 36, 280);
    const seed = hashString(`${localeKey}|${normalizeText(text)}|${voiceConfig.speed}|${voiceConfig.pitchRange}|${voiceConfig.tomodachi.humanize}`);
    const random = seededRandom(seed);
    const tokens: SynthToken[] = [];
    const toneBaseMul = 0.78 + (clamp(voiceConfig.pitchRange, 0, 24) / 24) * 0.72;

    for (const symbol of phonemes) {
      if (symbol.startsWith('PAUSE_')) {
        const pauseMultiplier =
          symbol === 'PAUSE_SHORT'
            ? 1.35
            : symbol === 'PAUSE_MEDIUM'
              ? 1.65
              : symbol === 'PAUSE_LONG'
                ? 2.1
                : 1.05;
        tokens.push({ kind: 'pause', durationMs: stepDurationMs * pauseMultiplier });
        continue;
      }

      const phoneme = buildFormantPhoneme(symbol);
      const humanizeStrength = clamp(voiceConfig.tomodachi.humanize, 0, 1);
      const jitterMul = 1 + ((random() * 2 - 1) * 0.05 * (0.2 + humanizeStrength));
      const durationMs = clamp(stepDurationMs * jitterMul, 22, 280);
      const pitchJitter = (random() * 2 - 1) * (0.025 + humanizeStrength * 0.075);
      const pitchMul = clamp(toneBaseMul + pitchJitter, 0.55, 2.25);

      tokens.push({
        kind: 'phoneme',
        phoneme,
        durationMs,
        pitchMul,
      });
    }

    const normalized = normalizeText(text);
    if (normalized.endsWith('?')) {
      for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token.kind !== 'phoneme') continue;
        token.pitchMul = clamp(token.pitchMul * 1.09, 0.55, 2.25);
        token.durationMs = clamp(token.durationMs * 0.95, 22, 280);
        break;
      }
    }

    return tokens;
  }

  private computeEstimatedDurationMs(tokens: SynthToken[], overlap: number): number {
    let totalMs = 0;
    for (const token of tokens) {
      if (token.kind === 'pause') {
        totalMs += token.durationMs;
      } else {
        totalMs += token.durationMs * overlap;
      }
    }
    return Math.max(0, Math.round(totalMs));
  }

  public estimateDurationMs(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): number {
    const tokens = this.buildTokens(text, voiceConfig, locale);
    const profile = getIntelligibilityProfile(voiceConfig.tomodachi.sampleSet);
    return this.computeEstimatedDurationMs(tokens, profile.overlap);
  }

  public async play(options: PlayTomodachiFormantNarrationOptions): Promise<NarratorPlaybackHandle> {
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

    const tokens = this.buildTokens(text, options.voiceConfig, options.locale);
    if (!tokens.length) {
      return {
        durationMs: 0,
        stop: () => undefined,
        unload: () => undefined,
        finished: Promise.resolve(),
      };
    }

    const profile = getIntelligibilityProfile(options.voiceConfig.tomodachi.sampleSet);
    const localeQualityScale = mapLocale(options.locale) === 'es' ? 1 : 0.96;
    const qualityScale = localeQualityScale * profile.qualityScale;
    const activeSources = new Set<AudioBufferSourceNode>();
    const gainNode = context.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(context.destination);

    const startAt = context.currentTime + (AUDIO_START_DELAY_MS / 1000);
    let cursorSec = 0;

    for (const token of tokens) {
      if (token.kind === 'pause') {
        cursorSec += token.durationMs / 1000;
        continue;
      }

      const cacheKey = `${options.voiceConfig.tomodachi.sampleSet}|${token.phoneme.symbol}|${Math.round(token.durationMs)}|${token.pitchMul.toFixed(3)}|${qualityScale.toFixed(2)}`;
      let phonemeBuffer = this.phonemeCache.get(cacheKey) ?? null;
      if (!phonemeBuffer) {
        phonemeBuffer = await generatePhonemeBuffer(token.phoneme, token.durationMs, token.pitchMul, qualityScale, profile);
        if (phonemeBuffer) {
          this.phonemeCache.set(cacheKey, phonemeBuffer);
          this.trimCache();
        }
      }
      if (!phonemeBuffer) {
        cursorSec += (token.durationMs * profile.overlap) / 1000;
        continue;
      }

      const source = context.createBufferSource();
      source.buffer = phonemeBuffer;
      source.connect(gainNode);
      const sourceStart = startAt + cursorSec;
      source.start(sourceStart);
      source.stop(sourceStart + (token.durationMs / 1000));

      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
      };

      cursorSec += (token.durationMs * profile.overlap) / 1000;
    }

    const durationMs = this.computeEstimatedDurationMs(tokens, profile.overlap);
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
    }, Math.max(0, durationMs + AUDIO_START_DELAY_MS + 40));

    const stop = () => {
      activeSources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Ignore double stop attempts.
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

const tomodachiFormantEngine = new TomodachiFormantEngine();

/**
 * Plays a comprehensible Tomodachi-like TTS using formant-inspired synthesis.
 */
export async function playTomodachiFormantNarration(options: PlayTomodachiFormantNarrationOptions): Promise<NarratorPlaybackHandle> {
  return tomodachiFormantEngine.play(options);
}

/**
 * Estimates duration for the Tomodachi formant synthesizer.
 */
export function estimateTomodachiFormantNarrationDurationMs(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): number {
  return tomodachiFormantEngine.estimateDurationMs(text, voiceConfig, locale);
}
