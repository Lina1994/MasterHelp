import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../apiBase';

type Props = {
  src: string; // absolute or relative URL
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  onErrorIcon?: React.ReactNode; // optional fallback icon
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
};

/** Maximum number of automatic retries before giving up. */
const MAX_RETRIES = 3;
/** Delay between retries in ms (doubles each attempt). */
const BASE_RETRY_DELAY = 2000;

/**
 * Image component that loads images via authenticated Axios request
 * and converts them to object URLs.
 *
 * Automatically retries failed requests and recovers when the page
 * becomes visible again after being backgrounded.
 */
export default function AuthImage({ src, alt, style, className, onErrorIcon, onLoad }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSrc = useRef<string | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadImage = useCallback(async (targetSrc: string, cancelled: { current: boolean }) => {
    setError(null);
    lastSrc.current = targetSrc;

    // If src is a data URL (base64), use it directly without authentication
    if (targetSrc.startsWith('data:')) {
      if (!cancelled.current) setObjectUrl(targetSrc);
      return;
    }

    try {
      const res = await api.get(targetSrc, { responseType: 'blob' });
      if (cancelled.current) return;
      const url = URL.createObjectURL(res.data);
      setObjectUrl((prev) => {
        if (prev && !prev.startsWith('data:')) URL.revokeObjectURL(prev);
        return url;
      });
      retryCount.current = 0; // Reset on success
    } catch (e: any) {
      if (cancelled.current) return;
      const status = e?.response?.status;
      const message = e?.message || 'Image fetch failed';
      console.error('[AuthImage] Failed to load image', { src: targetSrc, status, message });

      // Only retry on network/server errors (not 4xx client errors like 401/404)
      if (!status || status >= 500) {
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current += 1;
          const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount.current - 1);
          retryTimer.current = setTimeout(() => {
            if (!cancelled.current) loadImage(targetSrc, cancelled);
          }, delay);
          return; // Don't set error state while retrying
        }
      }
      setError(`${status || 'network'}`);
    }
  }, []);

  useEffect(() => {
    const cancelled = { current: false };
    // Cleanup previous
    setObjectUrl((prev) => {
      if (prev && !prev.startsWith('data:')) URL.revokeObjectURL(prev);
      return null;
    });
    retryCount.current = 0;
    if (retryTimer.current) clearTimeout(retryTimer.current);

    if (src) loadImage(src, cancelled);
    return () => {
      cancelled.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setObjectUrl((prev) => {
        if (prev && !prev.startsWith('data:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, loadImage]);

  // Re-load when the page becomes visible again (handles sleep/hibernate recovery)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && lastSrc.current && !objectUrl) {
        retryCount.current = 0;
        loadImage(lastSrc.current, { current: false });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [objectUrl, loadImage]);

  if (error) {
    return onErrorIcon ? <>{onErrorIcon}</> : null;
  }
  if (!objectUrl) return null;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={objectUrl} alt={alt} style={style} className={className} onLoad={onLoad} />;
}
