import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

const marquee = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

interface MarqueeTextProps {
  text: string;
  speedMs?: number; // total duration for a full cycle
}

/**
 * MarqueeText muestra un texto en una sola línea y, si no cabe,
 * activa un scroll lateral infinito duplicando el contenido.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({ text, speedMs = 15000 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const check = () => {
      const c = containerRef.current;
      const s = contentRef.current;
      if (!c || !s) return;
      setOverflowing(s.scrollWidth > c.clientWidth);
    };
    check();
    const ro = new ResizeObserver(() => check());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  // Duplicated content only when overflowing
  const inner = useMemo(() => (
    <>
      <span ref={contentRef} style={{ paddingRight: 32, display: 'inline-block' }}>{text}</span>
      {overflowing && <span style={{ paddingRight: 32, display: 'inline-block' }}>{text}</span>}
    </>
  ), [text, overflowing]);

  return (
    <Tooltip title={text}>
      <Box ref={containerRef} sx={{ overflow: 'hidden', width: '100%' }}>
        <Typography
          variant="subtitle2"
          component="div"
          noWrap={!overflowing}
          sx={overflowing ? {
            display: 'inline-block',
            whiteSpace: 'nowrap',
            animation: `${marquee} ${speedMs}ms linear infinite`,
          } : undefined}
        >
          {inner}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default MarqueeText;
