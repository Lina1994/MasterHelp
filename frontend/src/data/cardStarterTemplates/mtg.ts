import type { CardTemplateInput } from '../../types/cardTemplates';

/**
 * Built-in starter template inspired by the classic TCG layout (Magic: The
 * Gathering proportions: 63 × 88 mm). Bound to a spell-style entity so the
 * generator previews render with realistic text out of the box (name, school,
 * description, power/toughness badge).
 *
 * Dimensions and slot positions are expressed in absolute millimetres from
 * the card's top-left corner so the on-screen preview matches the printed
 * PDF exactly. The slot IDs are stable and unique so callers can reference
 * them when duplicating into the user's library.
 */
export const STARTER_TEMPLATE_MTG: CardTemplateInput = {
  name: 'Coleccionable (estilo Magic)',
  description:
    'Plantilla clásica estilo Magic resolviendo imagen grande, nombre, coste, línea de tipo, descripción y estadísticas en la esquina inferior.',
  widthMm: 63,
  heightMm: 88,
  orientation: 'portrait',
  sizePreset: 'POKER',
  globalStyle: {
    backgroundColor: '#f4ecd8',
    textColor: '#1a1a1a',
    fontFamily: 'system-ui, sans-serif',
  },
  slots: [
    {
      id: 'mtg-frame-outer',
      name: 'Borde exterior',
      type: 'FRAME',
      position: { x: 0, y: 0, w: 63, h: 88 },
      style: { borderWidth: 3.5, borderColor: '#111111', borderRadius: 2.5, color: '#111111' },
      binding: { isStatic: true },
    },
    {
      id: 'mtg-frame-inner',
      name: 'Marco vintage',
      type: 'FRAME',
      position: { x: 4, y: 4, w: 55, h: 80 },
      style: { borderWidth: 0.5, borderColor: '#3b2a1a', borderRadius: 1.5, color: '#3b2a1a' },
      binding: { isStatic: true },
    },
    {
      id: 'mtg-name',
      name: 'Nombre de la carta',
      type: 'TEXT_SINGLE',
      position: { x: 5.5, y: 5.5, w: 42, h: 5 },
      style: { fontWeight: 700, fontSize: 8 },
      binding: { fieldPath: 'name', fallbackText: 'Nombre de la carta' },
    },
    {
      id: 'mtg-cost',
      name: 'Coste',
      type: 'BADGE',
      position: { x: 48, y: 5, w: 9, h: 6 },
      style: {
        textAlign: 'center',
        backgroundColor: '#a9a9a9',
        color: '#ffffff',
        fontSize: 6,
        fontWeight: 700,
        borderRadius: 1.5,
      },
      binding: { isStatic: true, fallbackText: '{M}' },
    },
    {
      id: 'mtg-art',
      name: 'Ilustración',
      type: 'IMAGE',
      position: { x: 5.5, y: 12, w: 52, h: 42 },
      style: { borderRadius: 0.5, objectFit: 'cover' },
      binding: { isStatic: true, fallbackText: '' },
    },
    {
      id: 'mtg-type',
      name: 'Línea de tipo',
      type: 'TEXT_SINGLE',
      position: { x: 5.5, y: 55.5, w: 52, h: 5 },
      style: { fontWeight: 600, fontSize: 7.5 },
      binding: { fieldPath: 'school', fallbackText: 'Criatura — Bestia' },
    },
    {
      id: 'mtg-divider',
      name: 'Separador',
      type: 'DIVIDER',
      position: { x: 5.5, y: 61, w: 52, h: 1 },
      style: { color: '#a09481' },
      binding: { isStatic: true },
      dividerConfig: { thickness: 0.4, orientation: 'horizontal' },
    },
    {
      id: 'mtg-desc',
      name: 'Caja de texto',
      type: 'TEXT_MULTI',
      position: { x: 6, y: 62.5, w: 51, h: 16.5 },
      style: { fontSize: 7 },
      binding: { fieldPath: 'description', fallbackText: 'Habilidad o texto narrativo de la carta.' },
    },
    {
      id: 'mtg-stats',
      name: 'Fuerza / Resistencia',
      type: 'BADGE',
      position: { x: 45.5, y: 76.5, w: 12, h: 6 },
      style: {
        textAlign: 'center',
        backgroundColor: '#e2d8c3',
        color: '#111',
        fontSize: 7.5,
        fontWeight: 800,
        borderRadius: 1.5,
        borderWidth: 0.5,
        borderColor: '#3b2a1a',
      },
      binding: { isStatic: true, fallbackText: '3/3' },
    },
  ],
};
