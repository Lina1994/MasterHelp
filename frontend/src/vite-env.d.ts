/// <reference types="vite/client" />

// Extender la interfaz Window para incluir las APIs expuestas por Electron
interface Window {
  electronAPI: {
    showConfirmDialog: (message: string) => Promise<boolean>;
    openMapsProjection?: (campaignId?: string) => Promise<boolean>;
    projectionReportSize?: (payload: { width: number; height: number; dpr?: number }) => void;
    onProjectionSize?: (cb: (payload: { width: number; height: number; dpr?: number }) => void) => () => void;
    projectionPoke?: (payload: any) => void;
    onProjectionPoke?: (cb: (payload: any) => void) => () => void;
  };
}