import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';

/**
 * useCampaignId
 * Devuelve el ID de la campaña activa asegurando su presencia.
 * Lanza un error si no existe campaña activa. Útil en vistas protegidas
 * que requieren siempre un contexto de campaña (ej. SoundtrackPage).
 */
export const useCampaignId = (): string => {
  const { activeCampaign } = useActiveCampaign();
  if (!activeCampaign?.id) {
    throw new Error('No hay campaña activa. Asegúrate de que el usuario seleccione una campaña.');
  }
  return activeCampaign.id;
};
