/**
 * Catalog of pre-built graphic ornaments the user can drop onto a card as a
 * ready-made IMAGE slot. Every element is encoded as an inline SVG data URI
 * so we don't need any external assets / hosting — the data URI travels
 * with the template JSON and renders identically on screen and in print.
 *
 * IMPORTANT — color: the data URI must use a *concrete* fill/stroke color
 * (not `currentColor`). When an SVG is consumed as `<img src="data:...">`
 * the host page does NOT propagate CSS `color` into the SVG's
 * `currentColor`, so all ornaments would otherwise render black regardless
 * of the slot's `style.color`. We bake the default accent (#7a3a17) into
 * each element so they look right straight out of the box.
 *
 * Each entry:
 *   - `id`: stable key used for React keys and for the slot auto-name.
 *   - `labelI18nKey`: translation key shown in the picker.
 *   - `defaultSizeMm`: the slot's native aspect ratio in mm so the inserted
 *     slot isn't awkwardly huge or tiny.
 *   - `dataUri`: a UTF-8 data:image/svg+xml URI (no base64 → readable diff).
 */

export interface CardGraphicElement {
  id: string;
  /** i18n key under the `cards_graphic_*` namespace. */
  labelI18nKey: string;
  /** Default width × height in mm — the inserted slot uses these as-is. */
  defaultSizeMm: { w: number; h: number };
  dataUri: string;
}

export interface CardGraphicGroup {
  /** i18n key for the group title. */
  labelI18nKey: string;
  items: CardGraphicElement[];
}

/**
 * Mint a compact inline-SVG data URI. We deliberately do NOT base64 —
 * keeping the diff readable is worth the few extra characters.
 *
 * Color is baked into the SVG body itself (see each `SWIRL`, `FILIGREE`,
 * etc. constant). We do this because `<img src=\"data:…\">` doesn't have
 * a CSS context for `currentColor`, and data: URIs don't accept query
 * strings, so any URL-level color override would be ignored anyway.
 */
function svgUri(svgInner: string, viewBoxSize: { w: number; h: number }): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${viewBoxSize.w} ${viewBoxSize.h}'>${svgInner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------- ORNAMENTS ---------- */

/** Small burst of curls — used as a divider or top ornament. */
const SWIRL = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M2 12 Q25 2 48 12 T94 12' />
     <path d='M2 22 Q25 12 48 22 T94 22' opacity='0.6' />
   </g>`,
  { w: 96, h: 24 },
);

/** Quarter-arc ornament meant for a card corner. */
const FILIGREE = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <path d='M0 0 L40 0 M0 0 L0 40' />
     <circle cx='2' cy='2' r='4' fill='#7a3a17' />
     <path d='M8 0 Q14 6 8 12' />
     <path d='M0 8 Q6 14 12 8' />
   </g>`,
  { w: 48, h: 48 },
);

/** Vine border — leaves curl along a band. */
const VINE = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='1.5' stroke-linecap='round'>
     <path d='M2 12 Q18 6 32 12 T62 12 T94 12' />
     <circle cx='14' cy='6' r='2' fill='#7a3a17' />
     <circle cx='34' cy='16' r='2' fill='#7a3a17' />
     <circle cx='54' cy='6' r='2' fill='#7a3a17' />
     <circle cx='74' cy='16' r='2' fill='#7a3a17' />
   </g>`,
  { w: 96, h: 22 },
);

/** Knotwork tile — small repeated geometric knot. */
const KNOTWORK = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M20 4 C32 12 32 28 20 36 C8 28 8 12 20 4 Z' />
     <path d='M20 12 C26 18 26 22 20 28 C14 22 14 18 20 12 Z' />
     <circle cx='20' cy='20' r='2' fill='#7a3a17' />
   </g>`,
  { w: 40, h: 40 },
);

/** Left flourish — a thin curl used to balance right-flourish at the corner. */
const FLOURISH_LEFT = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M48 12 Q28 12 18 22 Q12 28 6 26' />
     <path d='M48 22 Q34 22 26 28' opacity='0.6' />
   </g>`,
  { w: 50, h: 30 },
);

/** Right flourish — mirror of flourish-left. */
const FLOURISH_RIGHT = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M2 12 Q22 12 32 22 Q38 28 44 26' />
     <path d='M2 22 Q16 22 24 28' opacity='0.6' />
   </g>`,
  { w: 50, h: 30 },
);

/** Banner ribbon — wavy banner with a tail. */
const BANNER = svgUri(
  `<g fill='#7a3a17'>
     <path d='M4 8 L92 4 L88 22 L8 26 Z' />
     <path d='M4 8 L8 26 L0 30 L4 22 Z' opacity='0.7' />
     <path d='M92 4 L88 22 L96 26 L92 22 Z' opacity='0.7' />
   </g>`,
  { w: 96, h: 32 },
);

/** Scroll corner — spiral corner piece. */
const SCROLL_CORNER = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M2 2 L16 2' />
     <path d='M2 2 L2 16' />
     <path d='M16 2 C22 2 22 10 14 10 C10 10 10 6 14 6' />
   </g>`,
  { w: 32, h: 32 },
);

/* ---------- DIVIDERS ---------- */

/** Thin round-bordered separator — works for ornamental cards. */
const ROUND_DIVIDER = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <line x1='4' y1='10' x2='92' y2='10' />
     <circle cx='4' cy='10' r='3' fill='#7a3a17' />
     <circle cx='92' cy='10' r='3' fill='#7a3a17' />
   </g>`,
  { w: 96, h: 20 },
);

/** Dotted separator — light-weight divider for dense card bodies. */
const DOTTED_DIVIDER = svgUri(
  `<g fill='#7a3a17'>
     ${[24, 48, 72].map((cx) => `<circle cx='${cx}' cy='6' r='2' />`).join('')}
   </g>`,
  { w: 96, h: 12 },
);

/** Dashed separator — alternating dashes + dots. */
const DASHED_DIVIDER = svgUri(
  `<g stroke='#7a3a17' fill='none' stroke-width='2' stroke-linecap='round'>
     <line x1='4' y1='6' x2='14' y2='6' />
     <line x1='22' y1='6' x2='32' y2='6' />
     <line x1='40' y1='6' x2='50' y2='6' />
     <line x1='58' y1='6' x2='68' y2='6' />
     <line x1='76' y1='6' x2='86' y2='6' />
   </g>`,
  { w: 90, h: 12 },
);

/** Double-line divider — two parallel rules with a gap. */
const DOUBLE_LINE_DIVIDER = svgUri(
  `<g stroke='#7a3a17' fill='none' stroke-width='1.5'>
     <line x1='4' y1='4' x2='92' y2='4' />
     <line x1='4' y1='8' x2='92' y2='8' />
   </g>`,
  { w: 96, h: 12 },
);

/** Beaded divider — small evenly-spaced beads. */
const BEADED_DIVIDER = svgUri(
  `<g fill='#7a3a17'>
     ${Array.from({ length: 9 }, (_, i) => `<circle cx='${i * 11 + 3}' cy='6' r='2' />`).join('')}
   </g>`,
  { w: 96, h: 12 },
);

/** Sunburst divider — small star burst in the centre. */
const SUNBURST = svgUri(
  `<g stroke='#7a3a17' fill='#7a3a17' stroke-linecap='round'>
     <line x1='4' y1='10' x2='30' y2='10' stroke-width='1.5' />
     <line x1='66' y1='10' x2='92' y2='10' stroke-width='1.5' />
     <g transform='translate(48 10)'>
       <polygon points='0,-8 2,-2 8,-2 3,2 5,8 0,4 -5,8 -3,2 -8,-2 -2,-2' />
     </g>
   </g>`,
  { w: 96, h: 20 },
);

/** Fleur divider — fleur-de-lis centred on a hairline. */
const FLEUR_DIVIDER = svgUri(
  `<g stroke='#7a3a17' fill='#7a3a17' stroke-linecap='round'>
     <line x1='4' y1='10' x2='34' y2='10' stroke-width='1.5' />
     <line x1='62' y1='10' x2='92' y2='10' stroke-width='1.5' />
     <g transform='translate(48 10)'>
       <path d='M0 -8 C3 -3 5 0 5 2 C5 5 2 6 0 6 C-2 6 -5 5 -5 2 C-5 0 -3 -3 0 -8 Z' />
     </g>
   </g>`,
  { w: 96, h: 20 },
);

/* ---------- ICONS ---------- */

/** A stylised crown — sized to fit inside a badge slot. */
const CROWN = svgUri(
  `<g fill='#7a3a17'>
     <path d='M4 22 L4 12 L12 18 L20 6 L28 18 L36 12 L36 22 Z' />
     <rect x='4' y='22' width='32' height='4' />
     <circle cx='12' cy='8' r='2' />
     <circle cx='28' cy='8' r='2' />
   </g>`,
  { w: 40, h: 28 },
);

/** Single sword icon. */
const SWORD = svgUri(
  `<g fill='#7a3a17'>
     <path d='M20 2 L24 30 L20 36 L16 30 Z' />
     <rect x='10' y='30' width='20' height='4' />
     <rect x='18' y='34' width='4' height='6' />
   </g>`,
  { w: 40, h: 42 },
);

/** Crossed daggers. */
const DAGGERS = svgUri(
  `<g fill='#7a3a17'>
     <g transform='rotate(-30 20 20)'>
       <path d='M20 4 L22 22 L20 28 L18 22 Z' />
       <rect x='14' y='22' width='12' height='3' />
     </g>
     <g transform='rotate(30 20 20)'>
       <path d='M20 4 L22 22 L20 28 L18 22 Z' />
       <rect x='14' y='22' width='12' height='3' />
     </g>
   </g>`,
  { w: 40, h: 36 },
);

/** Single axe. */
const AXE = svgUri(
  `<g fill='#7a3a17'>
     <rect x='19' y='6' width='2' height='34' />
     <path d='M6 6 L26 12 L26 20 L6 26 Z' />
   </g>`,
  { w: 32, h: 42 },
);

/** Bow + arrow silhouette. */
const BOW = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
     <path d='M10 4 Q26 20 10 36' />
     <line x1='12' y1='4' x2='32' y2='8' />
     <polygon points='30,4 36,8 30,10' fill='#7a3a17' />
   </g>`,
  { w: 40, h: 40 },
);

/** Round shield icon. */
const SHIELD = svgUri(
  `<g fill='#7a3a17'>
     <path d='M20 2 C32 6 36 12 36 18 C36 28 28 36 20 40 C12 36 4 28 4 18 C4 12 8 6 20 2 Z' />
   </g>`,
  { w: 40, h: 44 },
);

/** Heart icon. */
const HEART = svgUri(
  `<g fill='#7a3a17'>
     <path d='M20 38 C8 28 2 22 2 14 C2 8 6 4 12 4 C16 4 19 7 20 10
              C21 7 24 4 28 4 C34 4 38 8 38 14 C38 22 32 28 20 38 Z' />
   </g>`,
  { w: 40, h: 42 },
);

/** Five-pointed star. */
const STAR = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='20,2 24,15 38,15 27,23 31,36 20,28 9,36 13,23 2,15 16,15' />
   </g>`,
  { w: 40, h: 40 },
);

/** Skull silhouette. */
const SKULL = svgUri(
  `<g fill='#7a3a17'>
     <path d='M12 6 C12 2 28 2 28 6 L32 18
              C32 26 28 30 28 30 L28 34
              C28 36 24 36 24 34
              L24 32 C20 32 20 32 16 32
              L16 34 C16 36 12 36 12 34
              L12 30 C8 26 8 22 8 18 Z' />
     <circle cx='16' cy='18' r='3' fill='#fff' />
     <circle cx='24' cy='18' r='3' fill='#fff' />
   </g>`,
  { w: 40, h: 38 },
);

/** Ghost silhouette with simple eyes. */
const GHOST = svgUri(
  `<g fill='#7a3a17'>
     <path d='M8 22 C8 12 16 4 20 4 C24 4 32 12 32 22
              L32 36 L28 32 L24 36 L20 32 L16 36 L12 32 L8 36 Z' />
     <circle cx='14' cy='18' r='2' fill='#fff' />
     <circle cx='26' cy='18' r='2' fill='#fff' />
   </g>`,
  { w: 40, h: 40 },
);

/** Dragon head silhouette. */
const DRAGON = svgUri(
  `<g fill='#7a3a17'>
     <path d='M4 16 C8 8 18 6 28 12 L36 10 L30 18 L36 24
              L26 22 C20 24 14 22 10 26 L4 22 Z' />
     <circle cx='30' cy='16' r='2' fill='#fff' />
   </g>`,
  { w: 40, h: 32 },
);

/** Wolf head silhouette. */
const WOLF = svgUri(
  `<g fill='#7a3a17'>
     <path d='M4 22 L4 14 L10 6 L14 12 L20 10 L26 12 L30 6 L36 14 L36 22
              C32 26 24 28 20 28 C16 28 8 26 4 22 Z' />
   </g>`,
  { w: 40, h: 30 },
);

/** Coin with rune. */
const COIN = svgUri(
  `<g fill='#7a3a17'>
     <circle cx='20' cy='20' r='18' />
     <text x='20' y='26' font-size='20' text-anchor='middle' fill='#fff' font-family='serif' font-weight='700'>✦</text>
   </g>`,
  { w: 40, h: 40 },
);

/** Lightning bolt. */
const LIGHTNING = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='20,2 8,22 18,22 14,38 30,16 20,16 26,2' />
   </g>`,
  { w: 40, h: 40 },
);

/** Flame drop. */
const FLAME = svgUri(
  `<g fill='#7a3a17'>
     <path d='M20 4 C24 12 32 16 32 24 C32 30 26 36 20 36 C14 36 8 30 8 24
              C8 16 16 12 20 4 Z' />
   </g>`,
  { w: 40, h: 40 },
);

/** Crescent moon. */
const MOON = svgUri(
  `<g fill='#7a3a17'>
     <path d='M28 4 C16 4 8 14 8 22 C8 32 16 36 28 36
              C20 32 16 26 16 22 C16 14 20 8 28 4 Z' />
   </g>`,
  { w: 36, h: 40 },
);

/** Sun with rays. */
const SUN = svgUri(
  `<g fill='#7a3a17'>
     <circle cx='20' cy='20' r='8' />
     <g stroke='#7a3a17' stroke-width='2' stroke-linecap='round'>
       <line x1='20' y1='2' x2='20' y2='6' />
       <line x1='20' y1='34' x2='20' y2='38' />
       <line x1='2' y1='20' x2='6' y2='20' />
       <line x1='34' y1='20' x2='38' y2='20' />
       <line x1='7' y1='7' x2='10' y2='10' />
       <line x1='30' y1='30' x2='33' y2='33' />
       <line x1='7' y1='33' x2='10' y2='30' />
       <line x1='30' y1='10' x2='33' y2='7' />
     </g>
   </g>`,
  { w: 40, h: 40 },
);

/** Ankh. */
const ANKH = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='3'>
     <circle cx='20' cy='10' r='6' />
     <line x1='20' y1='16' x2='20' y2='36' />
     <line x1='10' y1='24' x2='30' y2='24' />
   </g>`,
  { w: 40, h: 40 },
);

/** Ring with gem (jewelry symbol). */
const RING = svgUri(
  `<g fill='#7a3a17'>
     <circle cx='20' cy='22' r='14' fill='none' stroke='#7a3a17' stroke-width='3' />
     <polygon points='20,2 26,8 24,14 16,14 14,8' />
   </g>`,
  { w: 40, h: 36 },
);

/** Faceted gem (lozenge cut). */
const GEM = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='20,2 36,16 20,36 4,16' />
     <line x1='4' y1='16' x2='36' y2='16' stroke='#fff' stroke-width='1' />
   </g>`,
  { w: 40, h: 40 },
);

/** Key. */
const KEY = svgUri(
  `<g fill='#7a3a17'>
     <circle cx='10' cy='14' r='6' fill='none' stroke='#7a3a17' stroke-width='3' />
     <rect x='14' y='12' width='22' height='4' />
     <rect x='30' y='16' width='3' height='6' />
     <rect x='24' y='16' width='3' height='6' />
   </g>`,
  { w: 36, h: 24 },
);

/** Padlock. */
const LOCK = svgUri(
  `<g fill='#7a3a17'>
     <path d='M12 18 L12 12 C12 6 16 2 20 2 C24 2 28 6 28 12 L28 18' fill='none' stroke='#7a3a17' stroke-width='3' />
     <rect x='6' y='18' width='28' height='20' rx='2' />
     <circle cx='20' cy='28' r='3' fill='#fff' />
   </g>`,
  { w: 40, h: 40 },
);

/** Potion flask. */
const POTION = svgUri(
  `<g fill='#7a3a17'>
     <rect x='14' y='2' width='12' height='6' />
     <path d='M14 8 L10 18 C6 26 10 36 20 36 C30 36 34 26 30 18 L26 8 Z' />
   </g>`,
  { w: 40, h: 40 },
);

/** Open scroll / book. */
const SCROLL = svgUri(
  `<g fill='#7a3a17'>
     <path d='M4 8 C12 6 22 6 36 10 L36 30 C22 26 12 26 4 28 Z' />
     <path d='M36 8 C28 6 18 6 4 10 L4 30 C18 26 28 26 36 28 Z' opacity='0.55' />
   </g>`,
  { w: 40, h: 32 },
);

/** Closed book. */
const BOOK = svgUri(
  `<g fill='#7a3a17'>
     <rect x='6' y='4' width='28' height='32' rx='1' />
     <line x1='20' y1='6' x2='20' y2='34' stroke='#fff' stroke-width='1' />
   </g>`,
  { w: 40, h: 40 },
);

/** Eyeball / wizard eye. */
const EYE = svgUri(
  `<g fill='#7a3a17'>
     <path d='M2 20 C8 8 32 8 38 20 C32 32 8 32 2 20 Z' />
     <circle cx='20' cy='20' r='6' fill='#fff' />
     <circle cx='20' cy='20' r='3' />
   </g>`,
  { w: 40, h: 40 },
);

/** Fleur-de-lis (heraldic). */
const FLEUR = svgUri(
  `<g fill='#7a3a17'>
     <path d='M20 4 C24 10 26 16 24 22 L30 16 L26 26 L34 22 L30 34 L20 32 L10 34 L6 22 L14 26 L10 16 L16 22 C14 16 16 10 20 4 Z' />
   </g>`,
  { w: 40, h: 38 },
);

/** Wand with sparkle. */
const WAND = svgUri(
  `<g stroke='#7a3a17' fill='#7a3a17' stroke-linecap='round'>
     <line x1='4' y1='36' x2='28' y2='6' stroke-width='3' />
     <polygon points='28,2 30,8 36,8 32,12 34,18 28,14 22,18 24,12 20,8 26,8' fill='#7a3a17' stroke='none' />
   </g>`,
  { w: 40, h: 40 },
);

/* ---------- FRAMES ---------- */

/** Simple round badge background — pair with TEXT for shield-like entities. */
const CIRCLE_BADGE = svgUri(
  `<g>
     <circle cx='24' cy='24' r='22' fill='#7a3a17' />
   </g>`,
  { w: 48, h: 48 },
);

/** Hex frame — perfect for "potion" or "rune" cards. */
const HEX_FRAME = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <polygon points='60,4 110,30 110,90 60,116 10,90 10,30' />
   </g>`,
  { w: 120, h: 120 },
);

/** Rounded rectangle — full-card outline. */
const ROUNDED_RECT_FRAME = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <rect x='4' y='4' width='112' height='152' rx='10' />
   </g>`,
  { w: 120, h: 160 },
);

/** Oval frame. */
const OVAL_FRAME = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <ellipse cx='60' cy='80' rx='56' ry='76' />
   </g>`,
  { w: 120, h: 160 },
);

/** Double circle frame. */
const DOUBLE_CIRCLE = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <circle cx='60' cy='60' r='52' />
     <circle cx='60' cy='60' r='44' />
   </g>`,
  { w: 120, h: 120 },
);

/** Corner brackets — emphasised rectangle corners only. */
const CORNER_BRACKETS = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='3' stroke-linecap='round'>
     <path d='M2 24 L2 2 L24 2' />
     <path d='M96 2 L118 2 L118 24' />
     <path d='M2 96 L2 118 L24 118' />
     <path d='M96 118 L118 118 L118 96' />
   </g>`,
  { w: 120, h: 120 },
);

/** Inner ornamental frame — drop on top of a card to add an extra border. */
const INNER_FRAME = svgUri(
  `<g fill='none' stroke='#7a3a17' stroke-width='2'>
     <rect x='4' y='4' width='112' height='152' rx='6' />
     <rect x='10' y='10' width='100' height='140' rx='4' />
     <circle cx='60' cy='80' r='3' />
   </g>`,
  { w: 120, h: 160 },
);

/* ---------- BADGES ---------- */

/** Pentagon badge (5-sided). */
const PENTAGON_BADGE = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='24,2 46,18 38,42 10,42 2,18' />
   </g>`,
  { w: 48, h: 44 },
);

/** Hexagon badge. */
const HEX_BADGE = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='24,2 44,12 44,32 24,42 4,32 4,12' />
   </g>`,
  { w: 48, h: 44 },
);

/** Ribbon badge — banner with notch tails. */
const RIBBON_BADGE = svgUri(
  `<g fill='#7a3a17'>
     <rect x='4' y='6' width='40' height='22' />
     <polygon points='4,28 12,22 4,38' />
     <polygon points='44,28 36,22 44,38' />
   </g>`,
  { w: 48, h: 40 },
);

/** Banner — wider ribbon. */
const BANNER_BADGE = svgUri(
  `<g fill='#7a3a17'>
     <path d='M2 4 L94 4 L88 22 L94 40 L2 40 L8 22 Z' />
   </g>`,
  { w: 96, h: 44 },
);

/** Scroll badge — rolled ends. */
const SCROLL_BADGE = svgUri(
  `<g fill='#7a3a17'>
     <rect x='4' y='6' width='88' height='24' />
     <circle cx='4' cy='18' r='10' />
     <circle cx='92' cy='18' r='10' />
     <circle cx='4' cy='18' r='5' fill='#fff' />
     <circle cx='92' cy='18' r='5' fill='#fff' />
   </g>`,
  { w: 96, h: 36 },
);

/** Rarity gem — diamond-shape. */
const RARITY_GEM = svgUri(
  `<g fill='#7a3a17'>
     <polygon points='20,2 38,18 20,38 2,18' />
   </g>`,
  { w: 40, h: 40 },
);

export const CARD_GRAPHIC_CATALOG: CardGraphicGroup[] = [
  {
    labelI18nKey: 'cards_graphic_group_ornaments',
    items: [
      { id: 'swirl', labelI18nKey: 'cards_graphic_swirl', defaultSizeMm: { w: 40, h: 6 }, dataUri: SWIRL },
      { id: 'filigree', labelI18nKey: 'cards_graphic_filigree', defaultSizeMm: { w: 14, h: 14 }, dataUri: FILIGREE },
      { id: 'vine', labelI18nKey: 'cards_graphic_vine', defaultSizeMm: { w: 40, h: 8 }, dataUri: VINE },
      { id: 'knotwork', labelI18nKey: 'cards_graphic_knotwork', defaultSizeMm: { w: 12, h: 12 }, dataUri: KNOTWORK },
      { id: 'flourish-left', labelI18nKey: 'cards_graphic_flourish_left', defaultSizeMm: { w: 18, h: 8 }, dataUri: FLOURISH_LEFT },
      { id: 'flourish-right', labelI18nKey: 'cards_graphic_flourish_right', defaultSizeMm: { w: 18, h: 8 }, dataUri: FLOURISH_RIGHT },
      { id: 'banner', labelI18nKey: 'cards_graphic_banner', defaultSizeMm: { w: 40, h: 12 }, dataUri: BANNER },
      { id: 'scroll-corner', labelI18nKey: 'cards_graphic_scroll_corner', defaultSizeMm: { w: 12, h: 12 }, dataUri: SCROLL_CORNER },
    ],
  },
  {
    labelI18nKey: 'cards_graphic_group_dividers',
    items: [
      { id: 'round-divider', labelI18nKey: 'cards_graphic_round_divider', defaultSizeMm: { w: 40, h: 4 }, dataUri: ROUND_DIVIDER },
      { id: 'dotted-divider', labelI18nKey: 'cards_graphic_dotted_divider', defaultSizeMm: { w: 30, h: 3 }, dataUri: DOTTED_DIVIDER },
      { id: 'dashed-divider', labelI18nKey: 'cards_graphic_dashed_divider', defaultSizeMm: { w: 36, h: 3 }, dataUri: DASHED_DIVIDER },
      { id: 'double-line-divider', labelI18nKey: 'cards_graphic_double_line_divider', defaultSizeMm: { w: 40, h: 3 }, dataUri: DOUBLE_LINE_DIVIDER },
      { id: 'beaded-divider', labelI18nKey: 'cards_graphic_beaded_divider', defaultSizeMm: { w: 40, h: 3 }, dataUri: BEADED_DIVIDER },
      { id: 'sunburst', labelI18nKey: 'cards_graphic_sunburst', defaultSizeMm: { w: 30, h: 6 }, dataUri: SUNBURST },
      { id: 'fleur-divider', labelI18nKey: 'cards_graphic_fleur_divider', defaultSizeMm: { w: 30, h: 6 }, dataUri: FLEUR_DIVIDER },
    ],
  },
  {
    labelI18nKey: 'cards_graphic_group_icons',
    items: [
      { id: 'crown', labelI18nKey: 'cards_graphic_crown', defaultSizeMm: { w: 12, h: 8 }, dataUri: CROWN },
      { id: 'sword', labelI18nKey: 'cards_graphic_sword', defaultSizeMm: { w: 10, h: 12 }, dataUri: SWORD },
      { id: 'daggers', labelI18nKey: 'cards_graphic_daggers', defaultSizeMm: { w: 12, h: 10 }, dataUri: DAGGERS },
      { id: 'axe', labelI18nKey: 'cards_graphic_axe', defaultSizeMm: { w: 10, h: 12 }, dataUri: AXE },
      { id: 'bow', labelI18nKey: 'cards_graphic_bow', defaultSizeMm: { w: 12, h: 12 }, dataUri: BOW },
      { id: 'shield', labelI18nKey: 'cards_graphic_shield', defaultSizeMm: { w: 10, h: 12 }, dataUri: SHIELD },
      { id: 'heart', labelI18nKey: 'cards_graphic_heart', defaultSizeMm: { w: 10, h: 11 }, dataUri: HEART },
      { id: 'star', labelI18nKey: 'cards_graphic_star', defaultSizeMm: { w: 10, h: 10 }, dataUri: STAR },
      { id: 'skull', labelI18nKey: 'cards_graphic_skull', defaultSizeMm: { w: 10, h: 10 }, dataUri: SKULL },
      { id: 'ghost', labelI18nKey: 'cards_graphic_ghost', defaultSizeMm: { w: 10, h: 10 }, dataUri: GHOST },
      { id: 'dragon', labelI18nKey: 'cards_graphic_dragon', defaultSizeMm: { w: 12, h: 10 }, dataUri: DRAGON },
      { id: 'wolf', labelI18nKey: 'cards_graphic_wolf', defaultSizeMm: { w: 12, h: 9 }, dataUri: WOLF },
      { id: 'coin', labelI18nKey: 'cards_graphic_coin', defaultSizeMm: { w: 10, h: 10 }, dataUri: COIN },
      { id: 'lightning', labelI18nKey: 'cards_graphic_lightning', defaultSizeMm: { w: 10, h: 10 }, dataUri: LIGHTNING },
      { id: 'flame', labelI18nKey: 'cards_graphic_flame', defaultSizeMm: { w: 10, h: 10 }, dataUri: FLAME },
      { id: 'moon', labelI18nKey: 'cards_graphic_moon', defaultSizeMm: { w: 9, h: 10 }, dataUri: MOON },
      { id: 'sun', labelI18nKey: 'cards_graphic_sun', defaultSizeMm: { w: 10, h: 10 }, dataUri: SUN },
      { id: 'ankh', labelI18nKey: 'cards_graphic_ankh', defaultSizeMm: { w: 10, h: 10 }, dataUri: ANKH },
      { id: 'ring', labelI18nKey: 'cards_graphic_ring', defaultSizeMm: { w: 10, h: 9 }, dataUri: RING },
      { id: 'gem', labelI18nKey: 'cards_graphic_gem', defaultSizeMm: { w: 10, h: 10 }, dataUri: GEM },
      { id: 'key', labelI18nKey: 'cards_graphic_key', defaultSizeMm: { w: 12, h: 7 }, dataUri: KEY },
      { id: 'lock', labelI18nKey: 'cards_graphic_lock', defaultSizeMm: { w: 10, h: 10 }, dataUri: LOCK },
      { id: 'potion', labelI18nKey: 'cards_graphic_potion', defaultSizeMm: { w: 10, h: 10 }, dataUri: POTION },
      { id: 'scroll', labelI18nKey: 'cards_graphic_scroll', defaultSizeMm: { w: 12, h: 10 }, dataUri: SCROLL },
      { id: 'book', labelI18nKey: 'cards_graphic_book', defaultSizeMm: { w: 10, h: 10 }, dataUri: BOOK },
      { id: 'eye', labelI18nKey: 'cards_graphic_eye', defaultSizeMm: { w: 10, h: 10 }, dataUri: EYE },
      { id: 'fleur', labelI18nKey: 'cards_graphic_fleur', defaultSizeMm: { w: 12, h: 12 }, dataUri: FLEUR },
      { id: 'wand', labelI18nKey: 'cards_graphic_wand', defaultSizeMm: { w: 12, h: 12 }, dataUri: WAND },
    ],
  },
  {
    labelI18nKey: 'cards_graphic_group_frames',
    items: [
      { id: 'circle-badge', labelI18nKey: 'cards_graphic_circle_badge', defaultSizeMm: { w: 12, h: 12 }, dataUri: CIRCLE_BADGE },
      { id: 'hex-frame', labelI18nKey: 'cards_graphic_hex_frame', defaultSizeMm: { w: 40, h: 40 }, dataUri: HEX_FRAME },
      { id: 'rounded-rect-frame', labelI18nKey: 'cards_graphic_rounded_rect_frame', defaultSizeMm: { w: 50, h: 70 }, dataUri: ROUNDED_RECT_FRAME },
      { id: 'oval-frame', labelI18nKey: 'cards_graphic_oval_frame', defaultSizeMm: { w: 50, h: 70 }, dataUri: OVAL_FRAME },
      { id: 'double-circle', labelI18nKey: 'cards_graphic_double_circle', defaultSizeMm: { w: 30, h: 30 }, dataUri: DOUBLE_CIRCLE },
      { id: 'corner-brackets', labelI18nKey: 'cards_graphic_corner_brackets', defaultSizeMm: { w: 50, h: 50 }, dataUri: CORNER_BRACKETS },
      { id: 'inner-frame', labelI18nKey: 'cards_graphic_inner_frame', defaultSizeMm: { w: 50, h: 70 }, dataUri: INNER_FRAME },
    ],
  },
  {
    labelI18nKey: 'cards_graphic_group_badges',
    items: [
      { id: 'pentagon-badge', labelI18nKey: 'cards_graphic_pentagon_badge', defaultSizeMm: { w: 14, h: 14 }, dataUri: PENTAGON_BADGE },
      { id: 'hex-badge', labelI18nKey: 'cards_graphic_hex_badge', defaultSizeMm: { w: 14, h: 14 }, dataUri: HEX_BADGE },
      { id: 'ribbon-badge', labelI18nKey: 'cards_graphic_ribbon_badge', defaultSizeMm: { w: 20, h: 16 }, dataUri: RIBBON_BADGE },
      { id: 'banner-badge', labelI18nKey: 'cards_graphic_banner_badge', defaultSizeMm: { w: 36, h: 16 }, dataUri: BANNER_BADGE },
      { id: 'scroll-badge', labelI18nKey: 'cards_graphic_scroll_badge', defaultSizeMm: { w: 36, h: 14 }, dataUri: SCROLL_BADGE },
      { id: 'rarity-gem', labelI18nKey: 'cards_graphic_rarity_gem', defaultSizeMm: { w: 12, h: 12 }, dataUri: RARITY_GEM },
    ],
  },
];
