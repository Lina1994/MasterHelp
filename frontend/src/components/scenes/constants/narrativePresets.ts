/**
 * @file narrativePresets.ts
 * @description Font options and style presets for the narrative text action editor
 *   and the narrative canvas tool panel.
 */

/** List of available font families for narrative text actions. */
export const NARRATIVE_FONT_OPTIONS = [
  'Merriweather',
  'Lora',
  'Playfair Display',
  'Cinzel',
  'Cormorant Garamond',
  'Libre Baskerville',
  'EB Garamond',
  'Noto Serif',
  'Montserrat',
  'Poppins',
] as const;

/** Quick style presets displayed in the StyleTab of NarrativePayloadFields. */
export const NARRATIVE_STYLE_PRESETS: Array<{
  id: string;
  label: string;
  patch: Record<string, unknown>;
}> = [
  {
    id: 'narrador',
    label: 'Narrador',
    patch: {
      fontFamily: 'Merriweather',
      fontSizePx: 28,
      fontColor: '#ffffff',
      textAlign: 'left',
      lineHeight: 1.35,
      backgroundMode: 'rect',
      backgroundColor: '#000000',
      backgroundOpacity: 0.58,
      borderRadiusPx: 12,
      paddingPx: 16,
    },
  },
  {
    id: 'susurro',
    label: 'Susurro',
    patch: {
      fontFamily: 'Cormorant Garamond',
      fontSizePx: 24,
      fontColor: '#dbeafe',
      textAlign: 'left',
      lineHeight: 1.45,
      fontStyle: 'italic',
      backgroundMode: 'none',
      paddingPx: 10,
    },
  },
  {
    id: 'aviso',
    label: 'Aviso',
    patch: {
      fontFamily: 'Montserrat',
      fontSizePx: 30,
      fontColor: '#fff7d6',
      textAlign: 'center',
      lineHeight: 1.25,
      fontWeight: 'bold',
      backgroundMode: 'capsule',
      backgroundColor: '#7c2d12',
      backgroundOpacity: 0.72,
      borderRadiusPx: 18,
      paddingPx: 14,
    },
  },
  {
    id: 'titulo',
    label: 'Título',
    patch: {
      fontFamily: 'Cinzel',
      fontSizePx: 38,
      fontColor: '#fef3c7',
      textAlign: 'center',
      lineHeight: 1.15,
      fontWeight: 'bold',
      backgroundMode: 'none',
    },
  },
  {
    id: 'ritual',
    label: 'Ritual',
    patch: {
      fontFamily: 'EB Garamond',
      fontSizePx: 32,
      fontColor: '#f5d0fe',
      textAlign: 'justify',
      lineHeight: 1.5,
      fontStyle: 'italic',
      backgroundMode: 'rect',
      backgroundColor: '#1f1147',
      backgroundOpacity: 0.68,
      borderRadiusPx: 8,
      paddingPx: 18,
    },
  },
];

/**
 * Richer presets used in the SceneFormDialog narrative tool panel.
 * Each entry includes a subtitle and pre-populates placement + typography.
 */
export const NARRATIVE_TOOL_STYLE_PRESETS: Array<{
  id: string;
  label: string;
  subtitle: string;
  patch: Record<string, unknown>;
}> = [
  {
    id: 'title-cinematic',
    label: 'Titulo cinematografico',
    subtitle: 'Grande y centrado',
    patch: {
      title: 'Titulo',
      text: 'Escribe aqui tu narracion...',
      stylePresetId: 'cinematicTitle',
      leftPct: 12,
      topPct: 60,
      widthPct: 76,
      heightPct: 24,
      textAlign: 'center',
      fontFamily: 'Cinzel',
      fontSizePx: 42,
      fontWeight: 'bold',
      backgroundMode: 'none',
      backgroundOpacity: 0,
    },
  },
  {
    id: 'subtitle-card',
    label: 'Subtitulo',
    subtitle: 'Lectura limpia',
    patch: {
      title: '',
      text: 'Texto de apoyo o descripcion breve.',
      stylePresetId: 'subtitleCard',
      leftPct: 8,
      topPct: 70,
      widthPct: 84,
      heightPct: 20,
      textAlign: 'left',
      fontFamily: 'Merriweather',
      fontSizePx: 28,
      lineHeight: 1.45,
      backgroundMode: 'rect',
      backgroundColor: '#111111',
      backgroundOpacity: 0.62,
    },
  },
  {
    id: 'lower-third',
    label: 'Lower third',
    subtitle: 'Etiqueta inferior',
    patch: {
      title: 'Ubicacion',
      text: 'Detalle contextual',
      stylePresetId: 'lowerThird',
      leftPct: 6,
      topPct: 78,
      widthPct: 58,
      heightPct: 16,
      textAlign: 'left',
      fontFamily: 'Montserrat',
      fontSizePx: 24,
      fontWeight: 'bold',
      backgroundMode: 'capsule',
      backgroundColor: '#0b1f3a',
      backgroundOpacity: 0.74,
      borderRadiusPx: 18,
    },
  },
  {
    id: 'minimal-note',
    label: 'Nota minimal',
    subtitle: 'Sin fondo',
    patch: {
      title: '',
      text: 'Nota breve',
      stylePresetId: 'minimalNote',
      leftPct: 68,
      topPct: 12,
      widthPct: 26,
      heightPct: 14,
      textAlign: 'right',
      fontFamily: 'Lato',
      fontSizePx: 22,
      fontStyle: 'italic',
      backgroundMode: 'none',
      backgroundOpacity: 0,
    },
  },
];
