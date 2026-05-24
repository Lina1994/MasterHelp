import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { MotionKeyframe, OscillationEffect } from '../../../types/scenes';
import { TransformEditor } from './TransformEditor';
import { MotionPathEditor } from './MotionPathEditor';
import { OscillationEditor, getDefaultOscillation } from './OscillationEditor';

interface TransformAnimationSectionProps {
  payload: Record<string, unknown>;
  setPayloadPatch: (patch: Record<string, unknown>) => void;
  durationMs: number;
}

/**
 * Combined section for transform (rotation/flip), motion path, and oscillation editors.
 *
 * Renders inside an Accordion to avoid crowding the action inspector, and applies
 * changes by calling setPayloadPatch with partial payload updates.
 *
 * @param props - Action payload, patch callback, and action duration for keyframe defaults.
 */
export const TransformAnimationSection: React.FC<TransformAnimationSectionProps> = ({
  payload,
  setPayloadPatch,
  durationMs,
}) => {
  const [expanded, setExpanded] = useState(false);

  const rotation = Number.isFinite(Number(payload.rotation)) ? Number(payload.rotation) : 0;
  const flipH = Boolean(payload.flipH);
  const flipV = Boolean(payload.flipV);
  const keyframes: MotionKeyframe[] = Array.isArray(payload.motionPath)
    ? (payload.motionPath as MotionKeyframe[])
    : [];
  const oscillation: OscillationEffect =
    payload.oscillation && typeof payload.oscillation === 'object'
      ? (payload.oscillation as OscillationEffect)
      : getDefaultOscillation();

  const hasAnimation =
    keyframes.length > 0 || (oscillation && oscillation.enabled);
  const hasTransform = rotation !== 0 || flipH || flipV;
  const hasAny = hasAnimation || hasTransform;

  const handleMotionPathChange = (nextKeyframes: MotionKeyframe[]) => {
    const requiredDurationMs = inferMotionPathRequiredDurationMs(nextKeyframes);
    const currentDurationMs = Number(payload.durationMs);
    const hasCurrentDuration = Number.isFinite(currentDurationMs) && currentDurationMs > 0;

    if (requiredDurationMs > 0 && (!hasCurrentDuration || currentDurationMs < requiredDurationMs)) {
      setPayloadPatch({
        motionPath: nextKeyframes,
        durationMs: requiredDurationMs,
      });
      return;
    }

    setPayloadPatch({ motionPath: nextKeyframes });
  };

  return (
    <Box sx={{ mt: 0.5 }}>
      <Divider sx={{ my: 0.5 }} />
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        disableGutters
        elevation={0}
        sx={{
          bgcolor: 'transparent',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ px: 0, minHeight: 32, py: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Transformación y movimiento
            </Typography>
            {hasAny && (
              <Box
                component="span"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 0.5,
                  px: 0.5,
                  fontSize: '0.55rem',
                  lineHeight: '1.4',
                }}
              >
                {[hasTransform && 'Trans.', hasAnimation && 'Mov.'].filter(Boolean).join(' · ')}
              </Box>
            )}
          </Stack>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 0, pt: 0, pb: 0.5 }}>
          <Stack spacing={1.5}>
            <TransformEditor
              rotation={rotation}
              flipH={flipH}
              flipV={flipV}
              onChange={(patch) => setPayloadPatch(patch)}
            />

            <Divider />

            <MotionPathEditor
              keyframes={keyframes}
              durationMs={durationMs}
              onChange={handleMotionPathChange}
            />

            <Divider />

            <OscillationEditor
              oscillation={oscillation}
              onChange={(next) => setPayloadPatch({ oscillation: next })}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

function inferMotionPathRequiredDurationMs(keyframes: MotionKeyframe[]): number {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return 0;

  const sorted = keyframes
    .filter((item) => item && Number.isFinite(Number(item.timeMs)))
    .slice()
    .sort((left, right) => Number(left.timeMs) - Number(right.timeMs));

  if (sorted.length === 0) return 0;

  let totalMs = 0;
  let previousTimeMs = 0;

  for (const keyframe of sorted) {
    const timeMs = Math.max(0, Number(keyframe.timeMs));
    const holdMs = Math.max(0, Number(keyframe.holdMs ?? 0));
    totalMs += Math.max(0, timeMs - previousTimeMs);
    totalMs += holdMs;
    previousTimeMs = timeMs;
  }

  return Math.max(0, Math.round(totalMs));
}
