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
    dispatchShortcutWindowAction?: (payload: any) => Promise<{ delivered: number }>;
    listShortcutWindows?: () => Promise<Array<{ id: string; kind: string; title: string; campaignId: string | null; webContentsId: number; createdAt: string }>>;
    onShortcutWindowAction?: (cb: (payload: any) => void) => () => void;
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
    /** Recarga la página de la app. */
    appReload?: () => void;
    /** Abre/cierra las DevTools. */
    appToggleDevTools?: () => void;
    /** Aumenta el zoom. */
    appZoomIn?: () => void;
    /** Reduce el zoom. */
    appZoomOut?: () => void;
    /** Restablece el zoom al 100 %. */
    appZoomReset?: () => void;
    // ── Auto-updater ───────────────────────────────────────────────────────
    /** Comprueba si hay una nueva versión disponible. */
    updaterCheck?: () => Promise<{ ok: boolean; error?: string }>;
    /** Inicia la descarga de la actualización disponible. */
    updaterDownload?: () => Promise<{ ok: boolean; error?: string }>;
    /** Cierra e instala la actualización descargada. */
    updaterInstall?: () => void;
    onUpdaterChecking?: (cb: () => void) => () => void;
    onUpdaterAvailable?: (cb: (info: { version: string; releaseDate?: string }) => void) => () => void;
    onUpdaterNotAvailable?: (cb: (info: { version: string }) => void) => () => void;
    onUpdaterProgress?: (cb: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
    onUpdaterDownloaded?: (cb: (info: { version: string }) => void) => () => void;
    onUpdaterError?: (cb: (err: { message: string }) => void) => () => void;
  };
}