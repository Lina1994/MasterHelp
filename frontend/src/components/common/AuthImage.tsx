import { useEffect, useRef, useState } from 'react';
import { api } from '../../apiBase';

type Props = {
  src: string; // absolute or relative URL
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  onErrorIcon?: React.ReactNode; // optional fallback icon
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
};

export default function AuthImage({ src, alt, style, className, onErrorIcon, onLoad }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSrc = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      // Cleanup previous url
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      lastSrc.current = src;
      try {
        const res = await api.get(src, { responseType: 'blob' });
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        setObjectUrl(url);
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status;
        const message = e?.message || 'Image fetch failed';
        // Minimal console logging to aid debugging as requested
        // eslint-disable-next-line no-console
        console.error('[AuthImage] Failed to load image', { src, status, message });
        setError(`${status || ''}`);
      }
    }
    if (src) load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (error) {
    return onErrorIcon ? <>{onErrorIcon}</> : null;
  }
  if (!objectUrl) return null;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={objectUrl} alt={alt} style={style} className={className} onLoad={onLoad} />;
}
