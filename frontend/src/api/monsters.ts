import { api } from '../apiBase';
import type { MonsterDetail, MonsterIndexItem } from '../types/monsters';

export async function fetchMonsters(manualId: string, params: {
  lang: 'en' | 'es';
  q?: string;
  type?: string;
  size?: string;
  crMin?: string;
  crMax?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MonsterIndexItem[]; total: number; page: number; pageSize: number }> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    clean[k] = v;
  }
  const r = await api.get(`/manuals/${manualId}/monsters`, { params: clean });
  return r.data;
}

export async function fetchMonster(manualId: string, slug: string, lang: 'en' | 'es'): Promise<MonsterDetail> {
  const r = await api.get(`/manuals/${manualId}/monsters/${slug}`, { params: { lang } });
  return r.data;
}
