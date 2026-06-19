import { Box, Button, Grid, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { DiaryCalendarConfig, DiaryDayRef } from '../../api/diary/diaryApi';
import { getDayOfYearIndex, getWeekdayIndex } from './diaryUtils';

export interface DiaryCalendarViewProps {
  config: DiaryCalendarConfig;
  selectedDay: DiaryDayRef | null;
  selectedMonthIndex: number;
  onMonthChange: (monthIndex: number) => void;
  onSelectDay: (day: DiaryDayRef) => void;
}

/**
 * Calendar UI for a custom campaign calendar.
 */
export function DiaryCalendarView({
  config,
  selectedDay,
  selectedMonthIndex,
  onMonthChange,
  onSelectDay,
}: DiaryCalendarViewProps) {
  const month = config.months[selectedMonthIndex];
  const weekLen = Math.max(1, config.weekDays.length);

  const monthStartDayOfYear = getDayOfYearIndex(config, {
    year: config.currentYear,
    monthIndex: selectedMonthIndex,
    dayIndex: 1,
  });
  const monthStartWeekday = monthStartDayOfYear % weekLen;

  const daysInMonth = Math.max(1, month?.days ?? 30);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography variant="h5">Calendario</Typography>
        <TextField
          select
          size="small"
          label="Mes"
          value={selectedMonthIndex}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          sx={{ minWidth: 220 }}
        >
          {config.months.map((m, idx) => (
            <MenuItem key={idx} value={idx}>
              {m.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Grid container spacing={1} columns={weekLen}>
        {config.weekDays.map((d, idx) => (
          <Grid key={idx} size={{ xs: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {d.name}
            </Typography>
          </Grid>
        ))}

        {Array.from({ length: monthStartWeekday }).map((_, i) => (
          <Grid key={`pad-${i}`} size={{ xs: 1 }}>
            <Box sx={{ height: 36 }} />
          </Grid>
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayIndex = i + 1;
          const day: DiaryDayRef = { year: config.currentYear, monthIndex: selectedMonthIndex, dayIndex };
          const isSelected =
            selectedDay?.year === day.year &&
            selectedDay?.monthIndex === day.monthIndex &&
            selectedDay?.dayIndex === day.dayIndex;

          // The campaign's "current day" (where the automatic adventure log is
          // written). It may differ from the day currently being viewed.
          const isCurrentDay =
            config.currentMonthIndex === selectedMonthIndex && config.currentDayIndex === dayIndex;

          const weekdayIndex = getWeekdayIndex(config, day);
          const isWeekend = weekdayIndex === weekLen - 1;

          const button = (
            <Button
              fullWidth
              size="small"
              variant={isSelected ? 'contained' : 'outlined'}
              color={isWeekend ? 'secondary' : 'primary'}
              onClick={() => onSelectDay(day)}
              sx={{
                minHeight: 36,
                px: 0.5,
                position: 'relative',
                ...(isCurrentDay && !isSelected
                  ? { borderColor: 'warning.main', borderWidth: 2, fontWeight: 700 }
                  : {}),
                ...(isCurrentDay
                  ? {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 3,
                        right: 3,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: 'warning.main',
                      },
                    }
                  : {}),
              }}
            >
              {dayIndex}
            </Button>
          );

          return (
            <Grid key={`day-${dayIndex}`} size={{ xs: 1 }}>
              {isCurrentDay ? (
                <Tooltip title="Día actual de la campaña (registro automático)" arrow>
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
