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
  playQueue: (items: Array<Omit<GlobalPlayerTrackMeta,'objectUrl'>>, loader: (id: string) => Promise<string>, opts?: { shuffle?: boolean }) => Promise<void>;
  stop: () => void;
  toggleLoop: () => void;
  next: () => Promise<void>;
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
  const queueRef = useRef<Array<Omit<GlobalPlayerTrackMeta,'objectUrl'>>>([]);
  const queueIndexRef = useRef<number>(-1);
  const queueLoaderRef = useRef<((id: string) => Promise<string>) | null>(null);
  // Guardar el último objectUrl para revocarlo al cambiar de pista / parar.
  const lastObjectUrlRef = useRef<string | null>(null);

  const play: GlobalPlayerContextType['play'] = useCallback(async (meta, loader) => {
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
    // avanzar al primer elemento
    const next = list[0];
    if (!next) return;
    queueIndexRef.current = 0;
    await play(next, () => loader(next.id));
  }, [play]);

  const next = useCallback(async () => {
    const list = queueRef.current;
    const loader = queueLoaderRef.current;
    if (!list || !loader) return;
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex >= list.length) {
      // fin de cola
      return;
    }
    queueIndexRef.current = nextIndex;
    const item = list[nextIndex];
    await play(item, () => loader(item.id));
  }, [play]);

  const stop = useCallback(() => {
    setCurrent(prev => {
      if (prev && prev.objectUrl) {
        URL.revokeObjectURL(prev.objectUrl);
        lastObjectUrlRef.current = null;
      }
      return null;
    });
  }, []);

  const toggleLoop = useCallback(() => setLoop(l => !l), []);

  // Cleanup general al desmontar provider.
  useEffect(() => () => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
  }, []);

  return (
    <GlobalPlayerContext.Provider value={{ current, loop, loading, play, playQueue, stop, toggleLoop, next }}>
      {children}
    </GlobalPlayerContext.Provider>
  );
};

export const useGlobalPlayer = () => {
  const ctx = useContext(GlobalPlayerContext);
  if (!ctx) throw new Error('useGlobalPlayer must be used within GlobalPlayerProvider');
  return ctx;
};
