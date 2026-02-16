import React from 'react';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import type { CampaignSpellDetail } from '../../api/spells/spellsApi';
import ReactMarkdown from 'react-markdown';

export const SpellStatBlock: React.FC<{ spell: CampaignSpellDetail }> = ({ spell }) => {
  const {
    name,
    level,
    school,
    castingTime,
    range,
    duration,
    components,
    materials,  
    classes,
    description,
    isConcentration,
    isRitual,
    savingThrow,
    areaOfEffect,
  } = spell;

  const levelLabel = level === 0 ? 'Cantrip' : `Level ${level}`;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{name}</Typography>
      
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={levelLabel} color="primary" size="small" />
        <Chip label={school} variant="outlined" size="small" />
        {isConcentration && <Chip label="Concentration" color="warning" size="small" />}
        {isRitual && <Chip label="Ritual" color="info" size="small" />}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Casting Time
          </Typography>
          <Typography variant="body1">{castingTime || '-'}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Range
          </Typography>
          <Typography variant="body1">{range || '-'}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Components
          </Typography>
          <Typography variant="body1">{components || '-'}</Typography>
          {materials && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
              ({materials})
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Duration
          </Typography>
          <Typography variant="body1">{duration || '-'}</Typography>
        </Box>

        {classes && classes.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Classes
            </Typography>
            <Typography variant="body1">{classes.join(', ')}</Typography>
          </Box>
        )}

        {savingThrow && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Saving Throw
            </Typography>
            <Typography variant="body1">{savingThrow}</Typography>
          </Box>
        )}

        {areaOfEffect && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Area of Effect
            </Typography>
            <Typography variant="body1">{areaOfEffect}</Typography>
          </Box>
        )}
      </Stack>

      {description && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Box sx={{ '& p': { mb: 1 }, '& ul, & ol': { pl: 2 } }}>
              <ReactMarkdown>{description}</ReactMarkdown>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SpellStatBlock;
