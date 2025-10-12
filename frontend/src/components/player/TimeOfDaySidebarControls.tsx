import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbShadeIcon from '@mui/icons-material/WbShade';
import { useTimeOfDay } from './TimeOfDayContext';
import { useTranslation } from 'react-i18next';

// Map icons to TOD: dawn, morning, afternoon, night
const items = [
  { key: 'dawn', labelKey: 'timeOfDay.dawn', icon: <WbTwilightIcon fontSize="small" /> },
  { key: 'morning', labelKey: 'timeOfDay.morning', icon: <WbSunnyIcon fontSize="small" /> },
  { key: 'afternoon', labelKey: 'timeOfDay.afternoon', icon: <WbShadeIcon fontSize="small" /> },
  { key: 'night', labelKey: 'timeOfDay.night', icon: <NightsStayIcon fontSize="small" /> },
] as const;

const TimeOfDaySidebarControls: React.FC = () => {
  const { timeOfDay, setTimeOfDay } = useTimeOfDay();
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {items.map((it) => (
        <Tooltip key={it.key} title={t(it.labelKey)}>
          <IconButton size="small" color={timeOfDay === it.key ? 'primary' : 'default'} onClick={() => setTimeOfDay(it.key as any)}>
            {it.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
};

export default TimeOfDaySidebarControls;
