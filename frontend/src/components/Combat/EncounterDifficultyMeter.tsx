import React, { useMemo } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { computeEncounterDifficulty, difficultyLabel, type DifficultyBand } from '../../utils/encounterDifficulty';

interface EncounterDifficultyMeterProps {
  /** Levels of the alive player-character allies. */
  partyLevels: number[];
  /** Challenge ratings of the alive enemies. */
  enemyCrs: number[];
  /** Compact rendering for dense contexts (e.g. list rows). */
  compact?: boolean;
}

/** Colors per difficulty band. */
const BAND_COLORS: Record<DifficultyBand, string> = {
  trivial: '#9e9e9e',
  easy: '#43a047',
  medium: '#fbc02d',
  hard: '#fb8c00',
  deadly: '#e53935',
};

/**
 * Live encounter difficulty meter. Renders a continuous colored scale
 * (trivial → fácil → media → difícil → mortal) with a marker showing exactly
 * where the current encounter sits, recomputed from the alive allies/enemies.
 */
export const EncounterDifficultyMeter: React.FC<EncounterDifficultyMeterProps> = ({ partyLevels, enemyCrs, compact = false }) => {
  const result = useMemo(() => computeEncounterDifficulty(partyLevels, enemyCrs), [partyLevels, enemyCrs]);
  const { thresholds, adjustedXp, band, partyCount, enemyCount } = result;

  // Axis: leave headroom above "deadly" so over-deadly encounters still fit.
  const axisMax = Math.max(thresholds.deadly * 1.3, thresholds.deadly + 1, adjustedXp * 1.05, 1);
  const pct = (x: number) => Math.min(100, Math.max(0, (x / axisMax) * 100));

  const pEasy = pct(thresholds.easy);
  const pMedium = pct(thresholds.medium);
  const pHard = pct(thresholds.hard);
  const pDeadly = pct(thresholds.deadly);
  const markerPct = pct(adjustedXp);

  const gradient = `linear-gradient(to right,
    ${BAND_COLORS.trivial} 0%, ${BAND_COLORS.trivial} ${pEasy}%,
    ${BAND_COLORS.easy} ${pEasy}%, ${BAND_COLORS.easy} ${pMedium}%,
    ${BAND_COLORS.medium} ${pMedium}%, ${BAND_COLORS.medium} ${pHard}%,
    ${BAND_COLORS.hard} ${pHard}%, ${BAND_COLORS.hard} ${pDeadly}%,
    ${BAND_COLORS.deadly} ${pDeadly}%, ${BAND_COLORS.deadly} 100%)`;

  if (partyCount === 0) {
    return (
      <Box sx={{ minWidth: compact ? 160 : 220 }}>
        <Typography variant="caption" color="text.secondary">
          {compact ? 'Dificultad: faltan aliados (PJ)' : 'Dificultad: añade aliados (PJ) para calcularla.'}
        </Typography>
      </Box>
    );
  }

  const barHeight = compact ? 10 : 14;

  return (
    <Box sx={compact ? { minWidth: 170, maxWidth: 260, flex: '0 1 220px' } : { minWidth: 240, maxWidth: 420 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: BAND_COLORS[band] }}>
          Dificultad: {difficultyLabel(band)}
        </Typography>
        {!compact && (
          <Typography variant="caption" color="text.secondary">
            {adjustedXp} XP · {enemyCount} enemigo(s)
          </Typography>
        )}
      </Stack>

      <Tooltip
        arrow
        title={`Fácil ${thresholds.easy} · Media ${thresholds.medium} · Difícil ${thresholds.hard} · Mortal ${thresholds.deadly} XP (umbrales del grupo) · ${adjustedXp} XP ajustados · ${enemyCount} enemigo(s)`}
      >
        <Box sx={{ position: 'relative', height: barHeight, borderRadius: 1, background: gradient, border: '1px solid', borderColor: 'divider' }}>
          {/* Marker showing where the current encounter sits */}
          <Box
            sx={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `${markerPct}%`,
              width: 0,
              borderLeft: '2px solid',
              borderColor: 'common.white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
              transform: 'translateX(-1px)',
              transition: 'left 0.25s ease',
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
};

export default EncounterDifficultyMeter;
