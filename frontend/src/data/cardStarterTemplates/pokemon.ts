import type { CardTemplateInput } from '../../types/cardTemplates';

/**
 * Built-in starter template themed after collector TCG cards (Pokémon-style
 * proportions: 63 × 88 mm). Uses three BADGEs at the bottom for weakness,
 * resistance and retreat cost so the footer stays scannable while still
 * leaving room for the artwork.
 */
export const STARTER_TEMPLATE_POKEMON: CardTemplateInput = {
  name: 'Coleccionable (estilo mascotas)',
  description:
    'Plantilla con marco amarillo grueso, HP destacado en la esquina, etapa, ilustración, descripción y badges de debilidad/resistencia/coste de retirada.',
  widthMm: 63,
  heightMm: 88,
  orientation: 'portrait',
  sizePreset: 'POKER',
  globalStyle: {
    backgroundColor: '#fdf6d8',
    textColor: '#1a1a1a',
    fontFamily: 'system-ui, sans-serif',
  },
  slots: [
    {
      id: 'pk-frame-outer',
      name: 'Borde amarillo',
      type: 'FRAME',
      position: { x: 0, y: 0, w: 63, h: 88 },
      style: { borderWidth: 2.5, borderColor: '#f5c542', borderRadius: 0, color: '#f5c542' },
      binding: { isStatic: true },
    },
    {
      id: 'pk-name',
      name: 'Nombre de la carta',
      type: 'TEXT_SINGLE',
      position: { x: 4, y: 4, w: 40, h: 6 },
      style: { fontWeight: 800, fontSize: 9.5 },
      binding: { fieldPath: 'name', fallbackText: 'Pikachu' },
    },
    {
      id: 'pk-hp',
      name: 'Puntos de salud',
      type: 'BADGE',
      position: { x: 45, y: 3.5, w: 14, h: 6 },
      style: {
        textAlign: 'right',
        backgroundColor: 'transparent',
        color: '#e3350d',
        fontSize: 8.5,
        fontWeight: 800,
      },
      binding: { fieldPath: 'maxHp', fallbackText: '60', suffix: ' HP' },
    },
    {
      id: 'pk-stage',
      name: 'Etapa',
      type: 'BADGE',
      position: { x: 4, y: 11, w: 15, h: 5 },
      style: {
        textAlign: 'center',
        backgroundColor: '#e5e5e5',
        fontSize: 6.5,
        fontWeight: 700,
        borderRadius: 2,
      },
      binding: { isStatic: true, fallbackText: 'BÁSICO' },
    },
    {
      id: 'pk-art',
      name: 'Ilustración',
      type: 'IMAGE',
      position: { x: 4, y: 17, w: 55, h: 36 },
      style: { borderRadius: 1.5, objectFit: 'cover' },
      binding: { isStatic: true, fallbackText: '' },
    },
    {
      id: 'pk-species',
      name: 'Especie',
      type: 'TEXT_SINGLE',
      position: { x: 4, y: 53.5, w: 55, h: 4 },
      style: { fontSize: 6.5, fontWeight: 700, textAlign: 'center', color: '#444' },
      binding: { fieldPath: 'type', fallbackText: 'Especie ratón. Altura 0.4 m. Peso 6.0 kg.' },
    },
    {
      id: 'pk-desc',
      name: 'Ataques y descripción',
      type: 'TEXT_MULTI',
      position: { x: 4, y: 59, w: 55, h: 16 },
      style: { fontSize: 7, textAlign: 'left' },
      binding: { fieldPath: 'description', fallbackText: 'Ataque principal: lanza una moneda. Si sale cara, paraliza al rival.' },
    },
    {
      id: 'pk-weakness',
      name: 'Debilidad',
      type: 'BADGE',
      position: { x: 4, y: 77, w: 16, h: 5 },
      style: {
        textAlign: 'center',
        fontSize: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        color: '#666',
        borderRadius: 1,
      },
      binding: { isStatic: true, fallbackText: 'W: Lucha' },
    },
    {
      id: 'pk-resistance',
      name: 'Resistencia',
      type: 'BADGE',
      position: { x: 23, y: 77, w: 16, h: 5 },
      style: {
        textAlign: 'center',
        fontSize: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        color: '#666',
        borderRadius: 1,
      },
      binding: { isStatic: true, fallbackText: 'R: Acero' },
    },
    {
      id: 'pk-retreat',
      name: 'Coste de retirada',
      type: 'BADGE',
      position: { x: 43, y: 77, w: 16, h: 5 },
      style: {
        textAlign: 'center',
        fontSize: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        color: '#666',
        borderRadius: 1,
      },
      binding: { isStatic: true, fallbackText: 'Retirada: 1' },
    },
  ],
};
