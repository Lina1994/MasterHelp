import React, { useMemo } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import {
  computeEncounterDifficulty,
  crToXp,
  difficultyLabel,
  formatCr,
} from '../../utils/encounterDifficulty';

interface EncounterDifficultyBreakdownProps {
  /** Levels of the player-character allies. */
  partyLevels: number[];
  /** Challenge ratings of the enemies. */
  enemyCrs: number[];
}

/** Groups a list of CRs into { cr, count } entries, sorted ascending. */
function groupCrs(enemyCrs: number[]): Array<{ cr: number; count: number }> {
  const map = new Map<number, number>();
  for (const cr of enemyCrs) map.set(cr, (map.get(cr) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([cr, count]) => ({ cr, count }))
    .sort((a, b) => a.cr - b.cr);
}

/**
 * Renders the formula and the underlying data that produced the encounter
 * difficulty shown by {@link EncounterDifficultyMeter}: enemy XP per CR, the
 * encounter-size multiplier, the adjusted XP and the party XP thresholds.
 */
export const EncounterDifficultyBreakdown: React.FC<EncounterDifficultyBreakdownProps> = ({ partyLevels, enemyCrs }) => {
  const result = useMemo(() => computeEncounterDifficulty(partyLevels, enemyCrs), [partyLevels, enemyCrs]);
  const groups = useMemo(() => groupCrs(enemyCrs), [enemyCrs]);
  const { thresholds, rawXp, adjustedXp, multiplier, band, partyCount, enemyCount } = result;

  return (
    <Box sx={{ p: 1.5, borderRadius: 1, border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' }}>
      <Stack spacing={0.75}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Cómo se calcula la dificultad
        </Typography>

        {/* Enemy XP per CR */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            1. XP de enemigos (por desafío):
          </Typography>
          {enemyCount === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', pl: 1 }}>
              Sin enemigos → 0 XP
            </Typography>
          ) : (
            <>
              {groups.map(({ cr, count }) => {
                const each = crToXp(cr);
                return (
                  <Typography key={cr} variant="caption" sx={{ display: 'block', pl: 1 }}>
                    {count}× CR {formatCr(cr)} × {each} XP = {count * each} XP
                  </Typography>
                );
              })}
              <Typography variant="caption" sx={{ display: 'block', pl: 1, fontWeight: 600 }}>
                XP base total = {rawXp} XP
              </Typography>
            </>
          )}
        </Box>

        {/* Multiplier */}
        <Typography variant="caption" color="text.secondary">
          2. Multiplicador por número de enemigos ({enemyCount}): ×{multiplier}
        </Typography>

        {/* Adjusted XP formula */}
        <Typography variant="caption">
          3. XP ajustada = {rawXp} × {multiplier} = <strong>{adjustedXp} XP</strong>
        </Typography>

        <Divider />

        {/* Party thresholds */}
        <Typography variant="caption" color="text.secondary">
          4. Umbrales del grupo ({partyCount} PJ{partyCount === 1 ? '' : ''}): Fácil {thresholds.easy} · Media {thresholds.medium} · Difícil {thresholds.hard} · Mortal {thresholds.deadly} XP
        </Typography>

        {/* Result */}
        <Typography variant="caption">
          5. Resultado: {adjustedXp} XP ajustada se sitúa en <strong>{difficultyLabel(band)}</strong>
        </Typography>
      </Stack>
    </Box>
  );
};

export default EncounterDifficultyBreakdown;
