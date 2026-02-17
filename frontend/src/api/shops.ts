import { api } from '../apiBase';

export type CellType = 'text' | 'image' | 'video' | 'audio' | 'gif';

export interface Shop {
  id: string;
  name: string;
  description?: string | null;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  sections: ShopSection[];
}

export interface ShopSection {
  id: string;
  name: string;
  order: number;
  shopId: string;
  columns: ShopColumn[];
  entries: ShopEntry[];
}

export interface ShopColumn {
  id: string;
  name: string;
  order: number;
  cellType: CellType;
  sectionId: string;
}

export interface ShopEntry {
  id: string;
  order: number;
  sectionId: string;
  cells: ShopCell[];
}

export interface ShopCell {
  id: string;
  textValue?: string | null;
  mimeType?: string | null;
  size?: number | null;
  originalUrl?: string | null;
  entryId: string;
  columnId: string;
  column: ShopColumn;
}

export interface CreateShopDto {
  name: string;
  description?: string;
  campaignId: string;
}

export interface UpdateShopDto {
  name?: string;
  description?: string;
}

export interface CreateSectionDto {
  name: string;
  order?: number;
}

export interface UpdateSectionDto {
  name?: string;
  order?: number;
}

export interface CreateColumnDto {
  name: string;
  cellType: CellType;
  order?: number;
}

export interface UpdateColumnDto {
  name?: string;
  cellType?: CellType;
  order?: number;
}

export interface CellValueDto {
  columnId: string;
  textValue?: string;
}

export interface CreateEntryDto {
  order?: number;
  cells?: CellValueDto[];
}

export interface UpdateCellValueDto {
  cellId?: string;
  columnId: string;
  textValue?: string;
}

export interface UpdateEntryDto {
  order?: number;
  cells?: UpdateCellValueDto[];
}

// ===== SHOPS =====

export async function listShops(campaignId: string): Promise<Shop[]> {
  const response = await api.get(`/shops?campaignId=${campaignId}`);
  return response.data;
}

export async function getShop(shopId: string): Promise<Shop> {
  const response = await api.get(`/shops/${shopId}`);
  return response.data;
}

export async function createShop(dto: CreateShopDto): Promise<Shop> {
  const response = await api.post('/shops', dto);
  return response.data;
}

export async function updateShop(shopId: string, dto: UpdateShopDto): Promise<Shop> {
  const response = await api.patch(`/shops/${shopId}`, dto);
  return response.data;
}

export async function deleteShop(shopId: string): Promise<void> {
  await api.delete(`/shops/${shopId}`);
}

// ===== SECTIONS =====

export async function createSection(shopId: string, dto: CreateSectionDto): Promise<ShopSection> {
  const response = await api.post(`/shops/${shopId}/sections`, dto);
  return response.data;
}

export async function updateSection(sectionId: string, dto: UpdateSectionDto): Promise<ShopSection> {
  const response = await api.patch(`/shops/sections/${sectionId}`, dto);
  return response.data;
}

export async function deleteSection(sectionId: string): Promise<void> {
  await api.delete(`/shops/sections/${sectionId}`);
}

// ===== COLUMNS =====

export async function createColumn(sectionId: string, dto: CreateColumnDto): Promise<ShopColumn> {
  const response = await api.post(`/shops/sections/${sectionId}/columns`, dto);
  return response.data;
}

export async function updateColumn(columnId: string, dto: UpdateColumnDto): Promise<ShopColumn> {
  const response = await api.patch(`/shops/columns/${columnId}`, dto);
  return response.data;
}

export async function deleteColumn(columnId: string): Promise<void> {
  await api.delete(`/shops/columns/${columnId}`);
}

// ===== ENTRIES =====

export async function createEntry(sectionId: string, dto: CreateEntryDto): Promise<ShopEntry> {
  const response = await api.post(`/shops/sections/${sectionId}/entries`, dto);
  return response.data;
}

export async function updateEntry(entryId: string, dto: UpdateEntryDto): Promise<ShopEntry> {
  const response = await api.patch(`/shops/entries/${entryId}`, dto);
  return response.data;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await api.delete(`/shops/entries/${entryId}`);
}

// ===== CELLS =====

export async function uploadCellMedia(
  entryId: string,
  columnId: string,
  file?: File,
  url?: string
): Promise<ShopCell> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (url) {
    formData.append('url', url);
  }

  const response = await api.post(
    `/shops/entries/${entryId}/cells/${columnId}/media`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

export async function updateCellText(cellId: string, textValue: string): Promise<ShopCell> {
  const response = await api.patch(
    `/shops/cells/${cellId}/text`,
    { textValue }
  );
  return response.data;
}

export function getCellStreamUrl(cellId: string): string {
  return `${api.defaults.baseURL}/shops/cells/${cellId}/stream`;
}

// ===== SEARCH =====

export async function searchEntries(campaignId: string, query: string): Promise<ShopEntry[]> {
  if (!query.trim()) return [];
  const response = await api.get(`/shops/search?campaignId=${campaignId}&q=${encodeURIComponent(query)}`);
  return response.data;
}
