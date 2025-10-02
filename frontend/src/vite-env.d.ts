/// <reference types="vite/client" />

// Extender la interfaz Window para incluir las APIs expuestas por Electron
interface Window {
  electronAPI: {
    showConfirmDialog: (message: string) => Promise<boolean>;
  };
}