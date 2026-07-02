import React from 'react';
import { Box, Chip, Divider, Grid, Typography } from '@mui/material';
import type { MonsterDetail } from '../../types/monsters';
import type { CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';

type MonsterLike = MonsterDetail | CampaignMonsterDetail;

export const MonsterStatBlock: React.FC<{ monster: MonsterLike }> = ({ monster }) => {
  const { name, type, size, alignment, challengeRating, armorClass, hitPoints, speed, abilities } = monster;
  const speedEntries = Object.entries(speed || {}).filter(([, v]) => typeof v === 'number') as [string, number][];
  const savingThrows = monster.savingThrows || {};
  const skills = monster.skills || {};
  const senses = monster.senses || {};
  // Defensive join: the SRD/manual source data for
  // `damage{Vulnerabilities,Resistances,Immunities}` and
  // `conditionImmunities` is currently a MIX of arrays (correct
  // schema) and raw strings like "fire, cold; bludgeoning…". Both
  // shapes render fine on screen; we just need to avoid crashing on
  // `.join` when a string slipped through. Keeps backwards compat
  // with already-stamped array files (e.g., the Spanish SRD parsed
  // by `parse_es_srd.py`).
  const joinList = (val?: string[] | string | null): string | undefined => {
    if (val == null) return undefined;
    if (Array.isArray(val)) return val.length ? val.join(', ') : undefined;
    if (typeof val === 'string') return val.trim() || undefined;
    return undefined;
  };
  const fmtSavingThrows = () => {
    const order: Array<keyof typeof savingThrows> = ['str','dex','con','int','wis','cha'];
    const parts: string[] = [];
    order.forEach(k => {
      const v = (savingThrows as any)[k];
      if (v !== undefined) parts.push(`${k.toUpperCase()} ${v >= 0 ? `+${v}` : v}`);
    });
    return parts.join(', ');
  };
  const fmtSkills = () => {
    const entries = Object.entries(skills);
    if (!entries.length) return '';
    const title = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
    return entries.map(([k, v]) => `${title(k)} ${v >= 0 ? `+${v}` : v}`).join(', ');
  };

  // Check if monster has image data (for CampaignMonsterDetail)
  const campaignMonster = monster as CampaignMonsterDetail;
  const hasIllustration = campaignMonster.imageUrls?.medium || campaignMonster.imageUrls?.high;
  const hasToken = campaignMonster.tokenImageUrl || campaignMonster.tokenColor;

  return (
    <Box>
      {/* Images Section */}
      {(hasIllustration || hasToken) && (
        <>
          <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {hasIllustration && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Ilustración
                </Typography>
                <img
                  src={campaignMonster.imageUrls?.medium || campaignMonster.imageUrls?.high}
                  alt={name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    borderRadius: 8,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  }}
                />
              </Box>
            )}
            {hasToken && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Token
                </Typography>
                {campaignMonster.tokenKind === 'image' && campaignMonster.tokenImageUrl ? (
                  <img
                    src={campaignMonster.tokenImageUrl}
                    alt={`${name} token`}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #ccc',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                ) : campaignMonster.tokenColor ? (
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      backgroundColor: campaignMonster.tokenColor,
                      border: '3px solid #ccc',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                ) : null}
              </Box>
            )}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      <Typography variant="h4" gutterBottom>{name}</Typography>
      <Typography variant="subtitle1" gutterBottom>
        {size || '-'} {type || '-'}{alignment ? `, ${alignment}` : ''} • CR {challengeRating || '-'}
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="body1"><strong>AC</strong>: {armorClass?.value ?? '-'}{armorClass?.type ? ` (${armorClass.type})` : ''}</Typography>
          <Typography variant="body1"><strong>HP</strong>: {hitPoints?.average ?? '-'}{hitPoints?.roll ? ` (${hitPoints.roll})` : ''}</Typography>
          <Typography variant="body1">
            <strong>Speed</strong>: {' '}
            {speedEntries.map(([k, v], i) => (
              <span key={k}>{k} {v} ft{i < speedEntries.length - 1 ? ', ' : ''}</span>
            ))}
          </Typography>
          {fmtSavingThrows() && (
            <Typography variant="body1"><strong>Saving Throws</strong>: {fmtSavingThrows()}</Typography>
          )}
          {fmtSkills() && (
            <Typography variant="body1"><strong>Skills</strong>: {fmtSkills()}</Typography>
          )}
          {joinList(monster.damageVulnerabilities) && (
            <Typography variant="body1"><strong>Damage Vulnerabilities</strong>: {joinList(monster.damageVulnerabilities)}</Typography>
          )}
          {joinList(monster.damageResistances) && (
            <Typography variant="body1"><strong>Damage Resistances</strong>: {joinList(monster.damageResistances)}</Typography>
          )}
          {joinList(monster.damageImmunities) && (
            <Typography variant="body1"><strong>Damage Immunities</strong>: {joinList(monster.damageImmunities)}</Typography>
          )}
          {joinList(monster.conditionImmunities) && (
            <Typography variant="body1"><strong>Condition Immunities</strong>: {joinList(monster.conditionImmunities)}</Typography>
          )}
          {(senses.blindsight || senses.darkvision || senses.tremorsense || senses.truesight || senses.passivePerception) && (
            <Typography variant="body1">
              <strong>Senses</strong>: {' '}
              {[
                senses.blindsight,
                senses.darkvision,
                senses.tremorsense,
                senses.truesight,
                senses.passivePerception !== undefined ? `Passive Perception ${senses.passivePerception}` : undefined,
              ].filter(Boolean).join(', ')}
            </Typography>
          )}
          {monster.languages && (
            <Typography variant="body1"><strong>Languages</strong>: {monster.languages}</Typography>
          )}
          {monster.proficiencyBonus !== undefined && (
            <Typography variant="body1"><strong>Proficiency Bonus</strong>: {monster.proficiencyBonus >= 0 ? `+${monster.proficiencyBonus}` : monster.proficiencyBonus}</Typography>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={1} columns={12}>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => (
              <Grid key={a}>
                <Chip label={`${a.toUpperCase()}: ${abilities?.[a] ?? '-'}`} />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {monster.traits?.length ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">Traits</Typography>
          {monster.traits.map((t, idx) => (
            <Box key={t.name || idx} sx={{ mt: 1 }}>
              {t.name ? (<Typography variant="subtitle2">{t.name}</Typography>) : null}
              <Typography variant="body2">{(t as any).text || (t as any).desc || ''}</Typography>
            </Box>
          ))}
        </>
      ) : null}

      {monster.actions?.length ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">Actions</Typography>
          {monster.actions.map((t, idx) => (
            <Box key={t.name || idx} sx={{ mt: 1 }}>
              {t.name ? (<Typography variant="subtitle2">{t.name}</Typography>) : null}
              <Typography variant="body2">{(t as any).text || (t as any).desc || ''}</Typography>
            </Box>
          ))}
        </>
      ) : null}

      {monster.reactions?.length ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">Reactions</Typography>
          {monster.reactions.map((t, idx) => (
            <Box key={t.name || idx} sx={{ mt: 1 }}>
              {t.name ? (<Typography variant="subtitle2">{t.name}</Typography>) : null}
              <Typography variant="body2">{(t as any).text || (t as any).desc || ''}</Typography>
            </Box>
          ))}
        </>
      ) : null}

      {monster.legendaryActions?.length ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">Legendary Actions</Typography>
          {monster.legendaryActions.map((t, idx) => (
            <Box key={t.name || idx} sx={{ mt: 1 }}>
              {t.name ? (<Typography variant="subtitle2">{t.name}</Typography>) : null}
              <Typography variant="body2">{(t as any).text || (t as any).desc || ''}</Typography>
            </Box>
          ))}
        </>
      ) : null}
    </Box>
  );
};

export default MonsterStatBlock;
