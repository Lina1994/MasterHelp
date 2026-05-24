/**
 * @file actionTypes.ts
 * @description Action type definitions, labels and window-type constants shared
 *   across the Scene editor and its sub-components.
 */

/** Union of all supported SceneAction type strings. */
export type SceneActionType =
  | 'sendVideoToWindow'
  | 'sendImageToWindow'
  | 'setWindowBackground'
  | 'applyWindowFilter'
  | 'clearWindow'
  | 'playMusic'
  | 'playPreset'
  | 'stopMusic'
  | 'setMusicVolume'
  | 'playSound'
  | 'stopSound'
  | 'setSoundVolume'
  | 'delay'
  | 'runShortcut'
  | 'runScene'
  | 'setNarrativeText'
  | 'setWeather'
  | 'hideWeather';

/** Ordered list of all action types shown in the type selector. */
export const ACTION_TYPES: SceneActionType[] = [
  'sendVideoToWindow',
  'sendImageToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindow',
  'playMusic',
  'playPreset',
  'stopMusic',
  'setMusicVolume',
  'playSound',
  'stopSound',
  'setSoundVolume',
  'delay',
  'runShortcut',
  'runScene',
  'setNarrativeText',
  'setWeather',
  'hideWeather',
];

/** Human-readable labels for each action type. */
export const ACTION_TYPE_LABELS: Record<SceneActionType, string> = {
  sendVideoToWindow: '📹 Enviar vídeo a ventana',
  sendImageToWindow: '🖼️ Enviar imagen a ventana',
  setWindowBackground: '🖼️ Establecer fondo de ventana',
  applyWindowFilter: '🎨 Aplicar filtro de ventana',
  clearWindow: '🧹 Limpiar ventana',
  playMusic: '🎵 Reproducir música',
  playPreset: '🎛️ Reproducir preset FX',
  stopMusic: '🔇 Detener música',
  setMusicVolume: '🔊 Ajustar volumen música',
  playSound: '🔊 Reproducir sonido',
  stopSound: '🔇 Detener sonido',
  setSoundVolume: '🔊 Ajustar volumen sonido',
  delay: '⏳ Pausa (Delay)',
  runShortcut: '⚡ Atajo rápido',
  runScene: '🎬 Cambiar a escena',
  setNarrativeText: '📜 Texto narrativo',
  setWeather: '⛈️ Tiempo atmosférico',
  hideWeather: '☀️ Ocultar tiempo atmosférico',
};

/** Human-readable labels for window destination kinds. */
export const DEST_WINDOW_LABELS: Record<string, string> = {
  main: 'Ventana principal (Director)',
  projection: 'Proyección (Jugadores / Mapa)',
  skyline: 'Skyline (Detalle)',
};

/**
 * Set of action types that target a specific window destination.
 * Used to decide whether a targetWindow field should be normalised.
 */
export const WINDOW_ACTION_TYPES = new Set([
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
  'setNarrativeText',
]);

/**
 * Set of action types whose timeline entry can be split at the playhead.
 */
export const SPLITTABLE_ACTION_TYPES = new Set([
  'sendVideoToWindow',
  'sendImageToWindow',
  'playMusic',
  'playSound',
]);
