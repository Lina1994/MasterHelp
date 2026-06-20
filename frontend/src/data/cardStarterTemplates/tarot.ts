import type { CardTemplateInput } from '../../types/cardTemplates';

/**
 * Built-in starter template in the classic Tarot / Arcanos proportions
 * (70 × 120 mm portrait). The slot IDs are stable so callers can reference
 * them when duplicating into the user's library.
 */
export const STARTER_TEMPLATE_TAROT: CardTemplateInput = {
  name: 'Tarot (Arcanos)',
  description:
    'Plantilla imponente estilo baraja de Tarot con marco ornamental fino, fondo oscuro y tipografía serif. Ideal para Arcano Mayor.',
  widthMm: 70,
  heightMm: 120,
  orientation: 'portrait',
  sizePreset: 'TAROT',
  globalStyle: {
    backgroundColor: '#1a1428',
    textColor: '#e8dcba',
    fontFamily: 'serif',
  },
  slots: [
    {
      id: 'tarot-frame-outer',
      name: 'Borde exterior',
      type: 'FRAME',
      position: { x: 0, y: 0, w: 70, h: 120 },
      style: { borderWidth: 1, borderColor: '#3a1a4a', borderRadius: 0, color: '#3a1a4a' },
      binding: { isStatic: true },
    },
    {
      id: 'tarot-frame-inner',
      name: 'Marco fino interior',
      type: 'FRAME',
      position: { x: 3, y: 3, w: 64, h: 114 },
      style: { borderWidth: 0.5, borderColor: '#3a1a4a', borderRadius: 2.5, color: '#3a1a4a' },
      binding: { isStatic: true },
    },
    {
      id: 'tarot-name',
      name: 'Título arcano',
      type: 'TEXT_SINGLE',
      position: { x: 10, y: 7, w: 50, h: 8 },
      style: { textAlign: 'center', fontSize: 13, color: '#d4af37', fontWeight: 700 },
      binding: { fieldPath: 'name', fallbackText: 'El Tonto' },
    },
    {
      id: 'tarot-number',
      name: 'Número',
      type: 'TEXT_SINGLE',
      position: { x: 30, y: 15, w: 10, h: 6 },
      style: { textAlign: 'center', fontSize: 10, color: '#d4af37' },
      binding: { isStatic: true, fallbackText: '0' },
    },
    {
      id: 'tarot-art',
      name: 'Ilustración principal',
      type: 'IMAGE',
      position: { x: 8, y: 24, w: 54, h: 62 },
      style: {
        borderRadius: 1.5,
        objectFit: 'cover',
        borderColor: '#3a1a4a',
        borderWidth: 0.5,
      },
      binding: { isStatic: true, fallbackText: '' },
    },
    {
      id: 'tarot-divider',
      name: 'Separador dorado',
      type: 'DIVIDER',
      position: { x: 12, y: 90, w: 46, h: 1 },
      style: { color: '#d4af37' },
      binding: { isStatic: true },
      dividerConfig: { thickness: 0.4, orientation: 'horizontal' },
    },
    {
      id: 'tarot-desc',
      name: 'Lectura / significado',
      type: 'TEXT_MULTI',
      position: { x: 7, y: 94, w: 56, h: 20 },
      style: { textAlign: 'center', fontSize: 8, color: '#c5b4df' },
      binding: { fieldPath: 'description', fallbackText: 'El inicio del viaje. Inocencia, espontaneidad y un salto de fe hacia lo desconocido.' },
    },
  ],
};
