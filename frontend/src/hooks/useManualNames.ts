import { useEffect, useState, useCallback } from 'react';
import { api } from '../apiBase';

interface ManualNameEntry {
  id: string;
  title: string;
  source?: 'file' | 'db';
}

/**
 * Hook that fetches the full manuals list once and provides a
 * `getManualName(id)` helper that resolves titles for both
 * file-based and DB manuals.
 */
export function useManualNames() {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<ManualNameEntry[]>('/manuals')
      .then(r => {
        const m: Record<string, string> = {};
        for (const manual of r.data) {
          m[manual.id] = manual.title;
        }
        setMap(m);
      })
      .catch(() => {});
  }, []);

  const getManualName = useCallback(
    (manualId: string | null | undefined): string => {
      if (!manualId) return 'Manual';
      return map[manualId] ?? manualId;
    },
    [map],
  );

  return { getManualName, manualNamesMap: map };
}
