
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Muestra un diálogo de confirmación nativo.
   * @param {string} message - El mensaje a mostrar en el diálogo.
   * @returns {Promise<boolean>} - Devuelve true si el usuario confirma, false en caso contrario.
   */
  showConfirmDialog: (message) => ipcRenderer.invoke('dialog:show-confirm', message),
  /** Abre la ventana de proyección de mapas (jugadores). */
  openMapsProjection: (campaignId) => ipcRenderer.invoke('maps:open-projection', { campaignId }),
  /** Abre la ventana de proyección de skyline. */
  openSkylineProjection: (campaignId) => ipcRenderer.invoke('skyline:open-projection', { campaignId }),
  /** Reporta el tamaño de la ventana de proyección. */
  projectionReportSize: (payload) => ipcRenderer.send('maps:projection-size', payload),
  /** Suscripción para recibir el tamaño de la ventana de proyección (en ventanas espejo). */
  onProjectionSize: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('maps:projection-size', listener);
    return () => ipcRenderer.removeListener('maps:projection-size', listener);
  },
  /** Poke projection windows to refresh from server immediately (optional hint). */
  projectionPoke: (payload) => ipcRenderer.send('maps:projection-poke', payload),
  /** Listener for projection poke broadcast */
  onProjectionPoke: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('maps:projection-poke', listener);
    return () => ipcRenderer.removeListener('maps:projection-poke', listener);
  },

  /** Reporta el tamaño de la ventana de proyección Skyline. */
  skylineProjectionReportSize: (payload) => ipcRenderer.send('skyline:projection-size', payload),
  /** Suscripción para recibir el tamaño de la ventana Skyline (en ventanas espejo). */
  onSkylineProjectionSize: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('skyline:projection-size', listener);
    return () => ipcRenderer.removeListener('skyline:projection-size', listener);
  },

  /** Minimiza la ventana principal. */
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  /** Alterna maximizar/restaurar la ventana principal. */
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  /** Cierra la ventana principal. */
  windowClose: () => ipcRenderer.send('window:close'),
  /** Consulta si la ventana está maximizada. */
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  /** Suscripción a cambios de estado maximizado. */
  onMaximizedChanged: (callback) => {
    const listener = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => ipcRenderer.removeListener('window:maximized-changed', listener);
  },

  /** Recarga la página de la app. */
  appReload: () => ipcRenderer.send('app:reload'),
  /** Abre/cierra las DevTools. */
  appToggleDevTools: () => ipcRenderer.send('app:toggle-devtools'),
  /** Aumenta el zoom. */
  appZoomIn: () => ipcRenderer.send('app:zoom-in'),
  /** Reduce el zoom. */
  appZoomOut: () => ipcRenderer.send('app:zoom-out'),
  /** Restablece el zoom al 100%. */
  appZoomReset: () => ipcRenderer.send('app:zoom-reset'),
});
