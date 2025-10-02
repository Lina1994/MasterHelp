
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Muestra un diálogo de confirmación nativo.
   * @param {string} message - El mensaje a mostrar en el diálogo.
   * @returns {Promise<boolean>} - Devuelve true si el usuario confirma, false en caso contrario.
   */
  showConfirmDialog: (message) => ipcRenderer.invoke('dialog:show-confirm', message),
});
