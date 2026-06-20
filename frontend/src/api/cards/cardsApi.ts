import { api } from '../../apiBase';
import type { CardTemplate, CardTemplateInput } from '../../types/cardTemplates';

/**
 * Lists every card template owned by the authenticated user.
 */
export async function listCardTemplates(): Promise<CardTemplate[]> {
  const res = await api.get('/card-templates');
  return res.data;
}

/**
 * Returns a single template by id (scoped to the authenticated user).
 */
export async function getCardTemplate(id: string): Promise<CardTemplate> {
  const res = await api.get(`/card-templates/${id}`);
  return res.data;
}

/**
 * Creates a new template owned by the authenticated user.
 */
export async function createCardTemplate(input: CardTemplateInput): Promise<CardTemplate> {
  const res = await api.post('/card-templates', input);
  return res.data;
}

/**
 * Patches an existing template.
 */
export async function updateCardTemplate(
  id: string,
  input: Partial<CardTemplateInput>,
): Promise<CardTemplate> {
  const res = await api.patch(`/card-templates/${id}`, input);
  return res.data;
}

/**
 * Deletes a template owned by the authenticated user.
 */
export async function deleteCardTemplate(id: string): Promise<void> {
  await api.delete(`/card-templates/${id}`);
}

/**
 * Duplicates a template under a " (Copia)" name. Backend handles the naming.
 */
export async function duplicateCardTemplate(id: string): Promise<CardTemplate> {
  const res = await api.post(`/card-templates/${id}/duplicate`);
  return res.data;
}
