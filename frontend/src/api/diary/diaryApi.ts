import { api } from '../../apiBase';

export type DiaryMonthConfig = { name: string; days: number };
export type DiaryWeekdayConfig = { name: string };

export type DiaryCalendarConfig = {
  currentYear: number;
  /**
   * Optional year label template. Use `{year}` placeholder.
   * Example: `{year} después del colapso`.
   */
  yearLabelTemplate?: string;
  months: DiaryMonthConfig[];
  weekDays: DiaryWeekdayConfig[];
};

export type CampaignCalendarResponse = {
  id: string;
  campaignId: string;
  config: DiaryCalendarConfig;
  updatedAt: string;
};

export type DiaryDayRef = { year: number; monthIndex: number; dayIndex: number };

export type DiaryEntryItemResponse = {
  id: string;
  title: string | null;
  html: string | null;
  isPublic: boolean;
  order: number;
  updatedAt: string;
  lastEditedByUserId?: number | null;
};

export type DiaryEntryResponse = {
  id: string | null;
  campaignId: string;
  year: number;
  monthIndex: number;
  dayIndex: number;
  items: DiaryEntryItemResponse[];
  updatedAt: string | null;
  lastEditedByUserId?: number | null;
};

export type DiarySessionResponse = {
  id: string;
  campaignId: string;
  title: string | null;
  isPublic: boolean;
  items: DiaryEntryItemResponse[];
  days: DiaryDayRef[];
  startedAt: string;
  endedAt: string | null;
  createdByUserId: number;
  updatedAt: string;
};

/** Read calendar configuration for a campaign. */
export async function getDiaryCalendar(campaignId: string) {
  const res = await api.get<CampaignCalendarResponse>(`/diary/campaigns/${campaignId}/calendar`);
  return res.data;
}

/** Update calendar configuration (masters only). */
export async function updateDiaryCalendar(campaignId: string, config: DiaryCalendarConfig) {
  const res = await api.patch<CampaignCalendarResponse>(`/diary/campaigns/${campaignId}/calendar`, config);
  return res.data;
}

export async function getDiaryEntry(campaignId: string, day: DiaryDayRef) {
  const res = await api.get<DiaryEntryResponse>(
    `/diary/campaigns/${campaignId}/entries/${day.year}/${day.monthIndex}/${day.dayIndex}`,
  );
  return res.data;
}

export async function upsertDiaryEntry(
  campaignId: string,
  payload: {
    year: number;
    monthIndex: number;
    dayIndex: number;
    items: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
  },
) {
  const res = await api.post<DiaryEntryResponse>(`/diary/campaigns/${campaignId}/entries/upsert`, payload);
  return res.data;
}

export async function listDiarySessions(campaignId: string) {
  const res = await api.get<DiarySessionResponse[]>(`/diary/campaigns/${campaignId}/sessions`);
  return res.data;
}

export async function getActiveDiarySession(campaignId: string) {
  const res = await api.get<DiarySessionResponse | null>(`/diary/campaigns/${campaignId}/sessions/active`);
  return res.data;
}

export async function startDiarySession(campaignId: string, payload?: { title?: string | null; isPublic?: boolean }) {
  const res = await api.post<DiarySessionResponse>(`/diary/campaigns/${campaignId}/sessions/start`, payload ?? {});
  return res.data;
}

export async function endDiarySession(campaignId: string, sessionId: string) {
  const res = await api.post<DiarySessionResponse>(`/diary/campaigns/${campaignId}/sessions/${sessionId}/end`);
  return res.data;
}

export async function visitDiaryDay(campaignId: string, sessionId: string, day: DiaryDayRef) {
  const res = await api.post<DiarySessionResponse>(`/diary/campaigns/${campaignId}/sessions/${sessionId}/visit-day`, { day });
  return res.data;
}

export async function updateDiarySession(
  campaignId: string,
  sessionId: string,
  payload: {
    title?: string | null;
    isPublic?: boolean;
    items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
  },
) {
  const res = await api.patch<DiarySessionResponse>(`/diary/campaigns/${campaignId}/sessions/${sessionId}`, payload);
  return res.data;
}

/**
 * Delete an ended diary session (masters only).
 */
export async function deleteDiarySession(campaignId: string, sessionId: string): Promise<void> {
  await api.delete(`/diary/campaigns/${campaignId}/sessions/${sessionId}`);
}
