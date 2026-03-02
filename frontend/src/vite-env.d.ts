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
    /** Minimiza la ventana principal. */
    windowMinimize?: () => void;
    /** Alterna maximizar/restaurar. */
    windowMaximize?: () => void;
    /** Cierra la ventana principal. */
    windowClose?: () => void;
    /** Consulta si la ventana está maximizada. */
    windowIsMaximized?: () => Promise<boolean>;
    /** Suscripción a cambios de estado maximizado. */
    onMaximizedChanged?: (cb: (isMaximized: boolean) => void) => () => void;
  };
}