import type { DiaryCalendarConfig, DiaryDayRef } from '../../api/diary/diaryApi';

/**
 * Computes day-of-year index (0-based) for a given date based on calendar config.
 */
export function getDayOfYearIndex(config: DiaryCalendarConfig, day: DiaryDayRef): number {
  const monthsBefore = config.months.slice(0, day.monthIndex);
  const offset = monthsBefore.reduce((sum, m) => sum + m.days, 0);
  return offset + (day.dayIndex - 1);
}

/**
 * Returns the weekday index (0-based) for a given day.
 */
export function getWeekdayIndex(config: DiaryCalendarConfig, day: DiaryDayRef): number {
  const weekLen = Math.max(1, config.weekDays.length);
  return getDayOfYearIndex(config, day) % weekLen;
}

export function formatDayLabel(config: DiaryCalendarConfig, day: DiaryDayRef): string {
  const month = config.months[day.monthIndex];
  const weekday = config.weekDays[getWeekdayIndex(config, day)];
  const monthName = month?.name ?? `Mes ${day.monthIndex + 1}`;
  const weekdayName = weekday?.name ?? `Día ${getWeekdayIndex(config, day) + 1}`;
  return `${weekdayName} · ${day.dayIndex} ${monthName} · Año ${day.year}`;
}
