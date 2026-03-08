import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../components/Campaign/CampaignContext';

/**
 * useCampaignId
 * Devuelve el ID de la campaña activa asegurando su presencia.
 *
 * Durante la carga inicial (campaigns aún en vuelo desde la API), `activeCampaign`
 * es `null` aunque el usuario ya tenga una campaña seleccionada persistida en
 * localStorage. Para evitar un crash en recarga de página, se devuelve
 * `activeCampaignId` (disponible de forma síncrona desde localStorage) mientras la
 * carga esté en curso.
 *
 * Lanza un error sólo cuando la carga ha completado y no hay campaña activa.
 * Útil en vistas protegidas que requieren siempre un contexto de campaña.
 */
export const useCampaignId = (): string => {
  const { activeCampaign, activeCampaignId, isLoading } = useActiveCampaign();
  const { loading: campaignsLoading } = useCampaignsContext();

  // While the context or campaign list is still loading, activeCampaign is null even
  // if a campaign IS selected (its object hasn't been resolved yet from the API list).
  // Return the raw ID from localStorage so callers don't crash on page reload.
  if ((isLoading || campaignsLoading) && activeCampaignId) {
    return activeCampaignId;
  }

  if (!activeCampaign?.id) {
    throw new Error('No hay campaña activa. Asegúrate de que el usuario seleccione una campaña.');
  }
  return activeCampaign.id;
};
