export type EmojiCategory = {
  id: string;
  label: string;
  emojis: string[];
};

export const EMOJI_RECENT_STORAGE_KEY = 'shortcut-emoji-picker-recents';
const RECENT_LIMIT = 24;

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'faces',
    label: 'Caras',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😋', '😜', '🤪', '🤨', '🧐', '🤩', '🤗',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestos',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '✋', '🖐️', '👋', '🤚',
      '🙌', '👏', '🤝', '🙏', '💪', '🫶', '👌🏼', '👍🏼',
    ],
  },
  {
    id: 'nature',
    label: 'Naturaleza',
    emojis: [
      '🌱', '🌿', '🍀', '🌳', '🌲', '🌵', '🌴', '🌸',
      '🌼', '🌻', '🌺', '🌹', '🌷', '🌞', '🌝', '🌈',
      '⚡', '❄️', '🔥', '💧', '🌊', '🍃', '☀️', '🌙',
    ],
  },
  {
    id: 'animals',
    label: 'Animales',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐨', '🐯', '🦁', '🐸', '🐵', '🐔', '🐧', '🐦',
      '🐤', '🐍', '🦋', '🐢', '🐙', '🦄', '🐝', '🦉',
    ],
  },
  {
    id: 'food',
    label: 'Comida',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓',
      '🫐', '🍒', '🥑', '🥕', '🌽', '🥐', '🥯', '🍞',
      '🧀', '🍕', '🍔', '🍟', '🌮', '🍜', '🍩', '🍪',
    ],
  },
  {
    id: 'activities',
    label: 'Actividades',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱',
      '🏓', '🏸', '🎮', '🎯', '🎲', '🎸', '🎹', '🎺',
      '🥁', '🎤', '🎧', '🎬', '🏆', '🥇', '🚴', '🏊',
    ],
  },
  {
    id: 'travel',
    label: 'Viajes',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑',
      '🚒', '🚚', '🚲', '🛵', '✈️', '🚀', '🚁', '🛶',
      '⛵', '🗺️', '🏖️', '🏜️', '🏕️', '🏔️', '🛣️', '🚉',
    ],
  },
  {
    id: 'objects',
    label: 'Objetos',
    emojis: [
      '💡', '🔦', '🕯️', '🎁', '📦', '📚', '📎', '✂️',
      '🔧', '🛠️', '🪛', '🧲', '🔑', '🗝️', '📱', '💻',
      '⌚', '📷', '🎥', '🖨️', '🧭', '🧰', '🧷', '🪫',
    ],
  },
  {
    id: 'symbols',
    label: 'Símbolos',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '💯', '✅', '❌', '⚠️', '⛔', '🔴',
      '🟠', '🟡', '🟢', '🔵', '🟣', '⭐', '✨', '🎵',
    ],
  },
  {
    id: 'fantasy',
    label: 'Fantasia',
    emojis: [
      '⚔️', '🛡️', '🧙', '🧛', '🧟', '🐉', '🔮', '🪄',
      '🧪', '🪙', '📜', '🗡️', '🏹', '💀', '👁️', '🕯️',
      '🪆', '🏰', '🧿', '📯', '🪶', '🧵', '🧶', '🧱',
    ],
  },
];

/**
 * Read the persisted emoji history from browser storage.
 */
export const readRecentEmojis = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(EMOJI_RECENT_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
};

/**
 * Store the emoji history in browser storage.
 */
export const writeRecentEmojis = (emojis: string[]): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(EMOJI_RECENT_STORAGE_KEY, JSON.stringify(emojis.slice(0, RECENT_LIMIT)));
  } catch {
    // Ignore storage failures.
  }
};

/**
 * Add one emoji to the front of the persisted history.
 */
export const recordRecentEmoji = (emoji: string): string[] => {
  if (!emoji) return readRecentEmojis();

  const next = [emoji, ...readRecentEmojis().filter((item) => item !== emoji)].slice(0, RECENT_LIMIT);
  writeRecentEmojis(next);
  return next;
};
