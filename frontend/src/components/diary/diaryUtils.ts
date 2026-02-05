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

/**
 * Formats the year label using the optional template.
 * Falls back to `Año N` when no valid template is configured.
 */
export function formatYearLabel(config: DiaryCalendarConfig, year: number): string {
  const template = (config.yearLabelTemplate ?? '').trim();
  if (template && template.includes('{year}')) {
    return template.split('{year}').join(String(year));
  }
  return `Año ${year}`;
}

/**
 * Compact day reference for lists (e.g. session visited days).
 */
export function formatDayRefCompact(config: DiaryCalendarConfig, day: DiaryDayRef): string {
  const month = config.months[day.monthIndex];
  const monthName = month?.name ?? `Mes ${day.monthIndex + 1}`;
  return `${day.dayIndex} ${monthName} · ${formatYearLabel(config, day.year)}`;
}

export function formatDayLabel(config: DiaryCalendarConfig, day: DiaryDayRef): string {
  const month = config.months[day.monthIndex];
  const weekday = config.weekDays[getWeekdayIndex(config, day)];
  const monthName = month?.name ?? `Mes ${day.monthIndex + 1}`;
  const weekdayName = weekday?.name ?? `Día ${getWeekdayIndex(config, day) + 1}`;
  return `${weekdayName} · ${day.dayIndex} ${monthName} · ${formatYearLabel(config, day.year)}`;
}
