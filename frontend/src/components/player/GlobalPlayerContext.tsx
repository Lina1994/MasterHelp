import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

export interface GlobalPlayerTrackMeta {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  objectUrl: string;
}

interface GlobalPlayerContextType {
  current: GlobalPlayerTrackMeta | null;
  loop: boolean;
  loading: boolean;
  play: (meta: Omit<GlobalPlayerTrackMeta,'objectUrl'>, objectUrlLoader: () => Promise<string>) => Promise<void>;
  playQueue: (items: Array<Omit<GlobalPlayerTrackMeta,'objectUrl'>>, loader: (id: string) => Promise<string>, opts?: { shuffle?: boolean; startIndex?: number }) => Promise<void>;
  stop: () => void;
  toggleLoop: () => void;
  next: () => Promise<void>;
  nextMode: 'sequential' | 'random';
  toggleNextMode: () => void;
  /** Indica si el reproductor está en modo playlist/cola (true) o en reproducción aislada (false). */
  isQueue: boolean;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | undefined>(undefined);

/**
 * Proveedor de estado del reproductor global.
 * Responsabilidades:
 * - Mantener metadatos de la pista actual y bandera de loop.
 * - Orquestar la carga (async) del object URL del audio.
 * - Limpiar object URLs antiguos para evitar pérdidas de memoria.
 * NOTA: El elemento <audio> vive fuera (en los controles) pero aquí podrían
 * añadirse refs o efectos para controlar reproducción/pause centralizadas si se amplía.
 */
export const GlobalPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<GlobalPlayerTrackMeta | null>(null);
  const [loop, setLoop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [nextMode, setNextMode] = useState<'sequential' | 'random'>('sequential');
  const queueRef = useRef<Array<Omit<GlobalPlayerTrackMeta,'objectUrl'>>>([]);
  const queueIndexRef = useRef<number>(-1);
  const queueLoaderRef = useRef<((id: string) => Promise<string>) | null>(null);
  const [queueActive, setQueueActive] = useState(false);
  // Guardar el último objectUrl para revocarlo al cambiar de pista / parar.
  const lastObjectUrlRef = useRef<string | null>(null);

  // Internal: play a track without altering queue/loop flags (for playlist/queue mode)
  const playQueueItem = useCallback(async (meta: Omit<GlobalPlayerTrackMeta,'objectUrl'>, objectUrlLoader: () => Promise<string>) => {
    setLoading(true);
    try {
      const url = await objectUrlLoader();
      if (lastObjectUrlRef.current && lastObjectUrlRef.current !== url) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
      lastObjectUrlRef.current = url;
      setCurrent({ ...meta, objectUrl: url });
    } finally {
      setLoading(false);
    }
  }, []);

  const play: GlobalPlayerContextType['play'] = useCallback(async (meta, loader) => {
    // Single track mode: clear queue and enable loop automatically
    queueRef.current = [];
    queueIndexRef.current = -1;
    queueLoaderRef.current = null;
    setQueueActive(false);
    setLoop(true);
    setLoading(true);
    try {
      const url = await loader();
      // Revocar URL previa si existe y es distinta para liberar memoria y evitar múltiples flujos.
      if (lastObjectUrlRef.current && lastObjectUrlRef.current !== url) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
      lastObjectUrlRef.current = url;
      setCurrent({ ...meta, objectUrl: url });
    } finally {
      setLoading(false);
    }
  }, []);

  const playQueue: GlobalPlayerContextType['playQueue'] = useCallback(async (items, loader, opts) => {
    const list = [...items];
    if (opts?.shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    queueRef.current = list;
    queueIndexRef.current = -1;
    queueLoaderRef.current = loader;
    // Para listas, por defecto desactivar loop para permitir avanzar automáticamente
    setLoop(false);
    setQueueActive(true);
    // avanzar al primer elemento
    if (!list.length) return;
    const startIndex = typeof opts?.startIndex === 'number' && opts.startIndex >= 0 && opts.startIndex < list.length ? opts.startIndex : 0;
    queueIndexRef.current = startIndex;
    const startItem = list[startIndex];
    await playQueueItem(startItem, () => loader(startItem.id));
  }, [playQueueItem]);

  const next = useCallback(async () => {
  // Use refs to avoid stale state closures; if there's no active queue, index will be -1 or loader/list missing.
  const list = queueRef.current;
  const loader = queueLoaderRef.current;
  if (!list || !loader || queueIndexRef.current < 0 || list.length === 0) return;
    let nextIndex: number;
    if (nextMode === 'sequential') {
      nextIndex = (queueIndexRef.current + 1) % list.length;
    } else {
      if (list.length <= 1) {
        nextIndex = queueIndexRef.current; // sólo una pista
      } else {
        // elegir aleatoria distinta de la actual
        do {
          nextIndex = Math.floor(Math.random() * list.length);
        } while (nextIndex === queueIndexRef.current);
      }
    }
    queueIndexRef.current = nextIndex;
    const item = list[nextIndex];
    await playQueueItem(item, () => loader(item.id));
  }, [playQueueItem, nextMode]);

  const stop = useCallback(() => {
    setCurrent(prev => {
      if (prev && prev.objectUrl) {
        URL.revokeObjectURL(prev.objectUrl);
        lastObjectUrlRef.current = null;
      }
      return null;
    });
    // stop queue context as well
    queueRef.current = [];
    queueIndexRef.current = -1;
    queueLoaderRef.current = null;
    setQueueActive(false);
  }, []);

  const toggleLoop = useCallback(() => setLoop(l => !l), []);
  const toggleNextMode = useCallback(() => setNextMode(m => (m === 'sequential' ? 'random' : 'sequential')), []);

  // Cleanup general al desmontar provider.
  useEffect(() => () => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
  }, []);

  // Persistencia de nextMode en localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('globalPlayer.nextMode');
      if (raw === 'sequential' || raw === 'random') {
        setNextMode(raw);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('globalPlayer.nextMode', nextMode); } catch {}
  }, [nextMode]);

  return (
    <GlobalPlayerContext.Provider value={{ current, loop, loading, play, playQueue, stop, toggleLoop, next, nextMode, toggleNextMode, isQueue: queueActive }}>
      {children}
    </GlobalPlayerContext.Provider>
  );
};

export const useGlobalPlayer = () => {
  const ctx = useContext(GlobalPlayerContext);
  if (!ctx) throw new Error('useGlobalPlayer must be used within GlobalPlayerProvider');
  return ctx;
};
