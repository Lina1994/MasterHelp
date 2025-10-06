import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { CharacterClass, ClassLevelProgression } from '../../types';

/**
 * Renders a spellcasting progression table for a given class levels array.
 * - Shows Level, PB, Features (resolved names when available), Cantrips Known (if present), and Spell Slots per Spell Level.
 * - Dynamically detects which slot levels (1..9) are present across the class and renders only those columns.
 */
export default function ClassSpellcastingTable({ data }: { data: CharacterClass }) {
  const featureNameById = useMemo(() => {
    const map = new Map<string, string>();
    (data.features || []).forEach(f => map.set(f.id, f.name));
    return map;
  }, [data.features]);

  const slotColumns: Array<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'> = useMemo(() => {
    const keys = ['1','2','3','4','5','6','7','8','9'] as const;
    // Include a slot column if any level has a slot > 0 for that key
    const present: Array<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'> = [];
    keys.forEach((k) => {
      const found = data.levels?.some((l) => {
        if (!l.spellSlots) return false;
        const val = l.spellSlots[k];
        return typeof val === 'number' && val > 0;
      });
      if (found) present.push(k);
    });
    return present.length ? present : [];
  }, [data.levels]);

  const rows: ClassLevelProgression[] = data.levels || [];

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Spellcasting Progression</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        For prepared casters (e.g., Wizard, Cleric), "Spells Known" shows the minimum spells recorded or n/a when variable. Wizards list the minimum spells in their spellbook by level.
      </Typography>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="right">Lvl</TableCell>
              <TableCell align="right">PB</TableCell>
              <TableCell>Features</TableCell>
              <TableCell align="right">Cantrips</TableCell>
              <TableCell align="right">Spells Known</TableCell>
              {slotColumns.map(k => (
                <TableCell key={k} align="right">{k}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const featureNames = (r.features || []).map(fid => featureNameById.get(fid) || fid);
              const cantrips = (typeof r.cantripsKnown === 'number')
                ? r.cantripsKnown
                : (typeof r.knownCantripsCount === 'number' ? r.knownCantripsCount : undefined);
              const spellsKnown = (typeof (r as any).knownSpellsCount === 'number') ? (r as any).knownSpellsCount : undefined;
              return (
                <TableRow key={r.level} hover>
                  <TableCell align="right">{r.level}</TableCell>
                  <TableCell align="right">+{r.proficiencyBonus}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {featureNames.join(', ')}
                  </TableCell>
                  <TableCell align="right">{typeof cantrips === 'number' ? cantrips : '-'}</TableCell>
                  <TableCell align="right">{typeof spellsKnown === 'number' ? spellsKnown : '-'}</TableCell>
                  {slotColumns.map(k => (
                    <TableCell key={k} align="right">{r.spellSlots ? r.spellSlots[k] : '-'}</TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
