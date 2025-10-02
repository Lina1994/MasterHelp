
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Determinar si estamos en modo de desarrollo
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  // Crear la ventana del navegador.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Enlazar el script de preload para una comunicación segura
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Cargar la URL del frontend.
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, './frontend/dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Abrir las DevTools en modo de desarrollo (opcional).
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Este método se llamará cuando Electron haya terminado la inicialización.
app.whenReady().then(() => {
  // Registrar el manejador para el diálogo de confirmación
  ipcMain.handle('dialog:show-confirm', async (event, message) => {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Cancelar', 'Confirmar'],
      defaultId: 1, // El índice del botón por defecto (Confirmar)
      title: 'Confirmar acción',
      message: message,
    });
    // Devuelve true si el botón presionado fue 'Confirmar' (índice 1)
    return result.response === 1;
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
