import { api } from '../apiBase';

/* ═══════════════════════════ Types ═══════════════════════════════ */

export interface ManualSummary {
  id: string;
  title: string;
  description?: string;
  version?: string;
  languages?: string[];
  source?: 'file' | 'db';
  editable?: boolean;
  /** Only present for file-based manuals */
  licenseName?: string;
  /** Whether the manual has a cover image (DB manuals only). */
  hasCover?: boolean;
}

export interface ManualDetail extends ManualSummary {
  createdByUserId?: number;
  createdAt?: string;
  updatedAt?: string;
  coverImageMimeType?: string | null;
}

export interface ManualEntry {
  id: string;
  manualId: string;
  entryType: ManualEntryType;
  entryKey: string;
  lang: string;
  data: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type ManualEntryType =
  | 'monster'
  | 'spell'
  | 'class'
  | 'race'
  | 'background'
  | 'feat'
  | 'trait'
  | 'skill'
  | 'section';

export interface CreateManualDto {
  title: string;
  description?: string;
  version?: string;
  languages?: string[];
}

export interface UpdateManualDto {
  title?: string;
  description?: string;
  version?: string;
  languages?: string[];
}

export interface CreateManualEntryDto {
  entryType: ManualEntryType;
  entryKey: string;
  lang: string;
  data: Record<string, any>;
}

export interface UpdateManualEntryDto {
  lang?: string;
  data?: Record<string, any>;
}

export interface ImportManualPayload {
  title: string;
  description?: string;
  version?: string;
  languages?: string[];
  entries: Array<{
    entryType: ManualEntryType;
    entryKey: string;
    lang: string;
    data: Record<string, any>;
  }>;
}

/* ═══════════════════════════ Manual CRUD ═════════════════════════ */

/**
 * List custom manuals belonging to the authenticated user.
 */
export async function listCustomManuals(): Promise<ManualDetail[]> {
  const res = await api.get<ManualDetail[]>('/custom-manuals');
  return res.data;
}

/**
 * Create a new custom manual.
 */
export async function createManual(dto: CreateManualDto): Promise<ManualDetail> {
  const res = await api.post<ManualDetail>('/custom-manuals', dto);
  return res.data;
}

/**
 * Get a single manual by ID.
 */
export async function getManual(id: string): Promise<ManualDetail> {
  const res = await api.get<ManualDetail>(`/custom-manuals/${id}`);
  return res.data;
}

/**
 * Update manual metadata.
 */
export async function updateManual(id: string, dto: UpdateManualDto): Promise<ManualDetail> {
  const res = await api.patch<ManualDetail>(`/custom-manuals/${id}`, dto);
  return res.data;
}

/**
 * Delete a manual and all its entries.
 */
export async function deleteManual(id: string): Promise<void> {
  await api.delete(`/custom-manuals/${id}`);
}

/* ═══════════════════════════ Entry CRUD ══════════════════════════ */

/**
 * List entries of a manual, optionally filtered by type and language.
 */
export async function listEntries(
  manualId: string,
  type?: ManualEntryType,
  lang?: string,
): Promise<ManualEntry[]> {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  if (lang) params.lang = lang;
  const res = await api.get<ManualEntry[]>(`/custom-manuals/${manualId}/entries`, { params });
  return res.data;
}

/**
 * Create a new entry inside a manual.
 */
export async function createEntry(manualId: string, dto: CreateManualEntryDto): Promise<ManualEntry> {
  const res = await api.post<ManualEntry>(`/custom-manuals/${manualId}/entries`, dto);
  return res.data;
}

/**
 * Get a single entry by ID.
 */
export async function getEntry(manualId: string, entryId: string): Promise<ManualEntry> {
  const res = await api.get<ManualEntry>(`/custom-manuals/${manualId}/entries/${entryId}`);
  return res.data;
}

/**
 * Update an existing entry.
 */
export async function updateEntry(
  manualId: string,
  entryId: string,
  dto: UpdateManualEntryDto,
): Promise<ManualEntry> {
  const res = await api.patch<ManualEntry>(`/custom-manuals/${manualId}/entries/${entryId}`, dto);
  return res.data;
}

/**
 * Delete an entry.
 */
export async function deleteEntry(manualId: string, entryId: string): Promise<void> {
  await api.delete(`/custom-manuals/${manualId}/entries/${entryId}`);
}

/* ═══════════════════════════ Import / Export ═════════════════════ */

/**
 * Export a manual as JSON. Returns the payload as an object.
 */
export async function exportManual(id: string): Promise<ImportManualPayload> {
  const res = await api.get<ImportManualPayload>(`/custom-manuals/${id}/export`);
  return res.data;
}

/**
 * Trigger a file download of the exported manual JSON.
 */
export async function downloadManualExport(id: string, title: string): Promise<void> {
  const payload = await exportManual(id);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manual-${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import a manual from a JSON payload.
 */
export async function importManual(payload: ImportManualPayload): Promise<ManualDetail> {
  const res = await api.post<ManualDetail>('/custom-manuals/import', payload);
  return res.data;
}

/* ═══════════════════════════ Cover Image ═════════════════════════ */

/**
 * Upload or replace the cover image for a manual.
 * @param manualId - UUID of the manual.
 * @param file     - The image File to upload.
 */
export async function uploadManualCover(manualId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await api.post(`/custom-manuals/${manualId}/cover`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Remove the cover image from a manual.
 * @param manualId - UUID of the manual.
 */
export async function removeManualCover(manualId: string): Promise<void> {
  await api.delete(`/custom-manuals/${manualId}/cover`);
}

/**
 * Returns the URL for fetching a manual's cover image.
 * @param manualId - UUID of the manual.
 */
export function getManualCoverUrl(manualId: string): string {
  return `/custom-manuals/${manualId}/cover`;
}
