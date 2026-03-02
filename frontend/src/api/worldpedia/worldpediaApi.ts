import { api } from '../../apiBase';

/* ═══════════════════════════ Types ═══════════════════════════════════ */

/** Lightweight note representation used in the tree listing. */
export interface WorldpediaNoteLight {
  id: string;
  title: string;
  folderId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorldpediaFolderWithNotes {
  id: string;
  campaignId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  notes: WorldpediaNoteLight[];
}

export interface WorldpediaTree {
  folders: WorldpediaFolderWithNotes[];
  rootNotes: WorldpediaNoteLight[];
}

export interface WorldpediaNoteLink {
  id: string;
  noteId: string;
  type: 'url' | 'note' | 'entity';
  label: string | null;
  targetUrl: string | null;
  targetNoteId: string | null;
  targetNote?: { id: string; title: string } | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  createdAt: string;
}

export interface WorldpediaBacklink extends WorldpediaNoteLink {
  note: { id: string; title: string; campaignId: string };
}

export interface WorldpediaNoteFull {
  id: string;
  campaignId: string;
  folderId: string | null;
  title: string;
  html: string | null;
  position: number;
  links: WorldpediaNoteLink[];
  backlinks: WorldpediaBacklink[];
  createdAt: string;
  updatedAt: string;
}

export interface WorldpediaFolder {
  id: string;
  campaignId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteLinkPayload {
  type: 'url' | 'note' | 'entity';
  label?: string | null;
  targetUrl?: string | null;
  targetNoteId?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
}

export interface WorldpediaExportData {
  folders: { originalId: string; name: string; position: number }[];
  notes: {
    originalId: string;
    title: string;
    html: string | null;
    originalFolderId: string | null;
    links: NoteLinkPayload[];
  }[];
}

/* ═══════════════════════════ API calls ═══════════════════════════════ */

/* ── Tree ─────────────────────────────────────────────────────────── */

/**
 * Fetch the full folder/note tree for a campaign.
 */
export async function getWorldpediaTree(campaignId: string): Promise<WorldpediaTree> {
  const res = await api.get<WorldpediaTree>(`/worldpedia/campaigns/${campaignId}/tree`);
  return res.data;
}

/* ── Folders ──────────────────────────────────────────────────────── */

export async function createFolder(campaignId: string, data: { name: string; position?: number }): Promise<WorldpediaFolder> {
  const res = await api.post<WorldpediaFolder>(`/worldpedia/campaigns/${campaignId}/folders`, data);
  return res.data;
}

export async function updateFolder(campaignId: string, folderId: string, data: { name?: string; position?: number }): Promise<WorldpediaFolder> {
  const res = await api.patch<WorldpediaFolder>(`/worldpedia/campaigns/${campaignId}/folders/${folderId}`, data);
  return res.data;
}

export async function deleteFolder(campaignId: string, folderId: string): Promise<void> {
  await api.delete(`/worldpedia/campaigns/${campaignId}/folders/${folderId}`);
}

/* ── Notes ────────────────────────────────────────────────────────── */

export async function createNote(
  campaignId: string,
  data: { title: string; html?: string | null; folderId?: string | null; position?: number; links?: NoteLinkPayload[] },
): Promise<WorldpediaNoteFull> {
  const res = await api.post<WorldpediaNoteFull>(`/worldpedia/campaigns/${campaignId}/notes`, data);
  return res.data;
}

export async function getNote(campaignId: string, noteId: string): Promise<WorldpediaNoteFull> {
  const res = await api.get<WorldpediaNoteFull>(`/worldpedia/campaigns/${campaignId}/notes/${noteId}`);
  return res.data;
}

export async function updateNote(
  campaignId: string,
  noteId: string,
  data: { title?: string; html?: string | null; folderId?: string | null; position?: number; links?: NoteLinkPayload[] },
): Promise<WorldpediaNoteFull> {
  const res = await api.patch<WorldpediaNoteFull>(`/worldpedia/campaigns/${campaignId}/notes/${noteId}`, data);
  return res.data;
}

export async function deleteNote(campaignId: string, noteId: string): Promise<void> {
  await api.delete(`/worldpedia/campaigns/${campaignId}/notes/${noteId}`);
}

export async function moveNote(campaignId: string, noteId: string, folderId: string | null, position?: number): Promise<WorldpediaNoteLight> {
  const body: { folderId: string | null; position?: number } = { folderId };
  if (position !== undefined) body.position = position;
  const res = await api.patch<WorldpediaNoteLight>(`/worldpedia/campaigns/${campaignId}/notes/${noteId}/move`, body);
  return res.data;
}

/* ── Reorder (batch) ──────────────────────────────────────────────── */

export interface ReorderItem {
  id: string;
  position: number;
  folderId?: string | null;
}

/**
 * Batch-update positions of folders and/or notes after drag-and-drop.
 */
export async function reorderWorldpedia(
  campaignId: string,
  data: { folders?: ReorderItem[]; notes?: ReorderItem[] },
): Promise<void> {
  await api.patch(`/worldpedia/campaigns/${campaignId}/reorder`, data);
}

/* ── Search ───────────────────────────────────────────────────────── */

export async function searchNotes(campaignId: string, query: string): Promise<WorldpediaNoteLight[]> {
  const res = await api.get<WorldpediaNoteLight[]>(`/worldpedia/campaigns/${campaignId}/search`, { params: { q: query } });
  return res.data;
}

/* ── Links ────────────────────────────────────────────────────────── */

export async function getNoteLinks(campaignId: string, noteId: string): Promise<{ links: WorldpediaNoteLink[]; backlinks: WorldpediaBacklink[] }> {
  const res = await api.get<{ links: WorldpediaNoteLink[]; backlinks: WorldpediaBacklink[] }>(`/worldpedia/campaigns/${campaignId}/notes/${noteId}/links`);
  return res.data;
}

/* ── Export ────────────────────────────────────────────────────────── */

export async function exportAll(campaignId: string): Promise<WorldpediaExportData> {
  const res = await api.get<WorldpediaExportData>(`/worldpedia/campaigns/${campaignId}/export`);
  return res.data;
}

export async function exportFolder(campaignId: string, folderId: string): Promise<WorldpediaExportData> {
  const res = await api.get<WorldpediaExportData>(`/worldpedia/campaigns/${campaignId}/export/folders/${folderId}`);
  return res.data;
}

export async function exportNote(campaignId: string, noteId: string): Promise<WorldpediaExportData> {
  const res = await api.get<WorldpediaExportData>(`/worldpedia/campaigns/${campaignId}/export/notes/${noteId}`);
  return res.data;
}

/* ── Import ────────────────────────────────────────────────────────── */

export async function importData(
  campaignId: string,
  data: WorldpediaExportData,
): Promise<{ foldersCreated: number; notesCreated: number }> {
  const res = await api.post<{ foldersCreated: number; notesCreated: number }>(`/worldpedia/campaigns/${campaignId}/import`, data);
  return res.data;
}
