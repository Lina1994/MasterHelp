export type LoopMode = 'continuous' | 'fixed' | 'random';

export interface SoundEffectMeta {
  id: string;
  name: string;
  category?: string | null;
  isPublic: boolean;
  size: number;
  mimeType: string;
}

export interface SectionedEffects {
  associated: SoundEffectMeta[];
  reusable: SoundEffectMeta[];
}

export interface PresetItemMeta {
  id: string;
  volume: number;
  loopMode: LoopMode;
  waitMs?: number | null;
  randomMinMs?: number | null;
  randomMaxMs?: number | null;
  echoEnabled?: boolean;
  echoDelayMs?: number | null;
  echoFeedback?: number | null;
  pitchSemitones?: number | null;
  soundEffect: SoundEffectMeta;
}

export interface SoundPresetMeta {
  id: string;
  name: string;
  items: PresetItemMeta[];
}
