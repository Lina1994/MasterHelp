
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Determinar si estamos en modo de desarrollo
const isDev = process.env.NODE_ENV !== 'production';

let projectionWindow = null;
let skylineWindow = null;

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

  // Crear/mostrar la ventana de proyección bajo demanda
  ipcMain.handle('maps:open-projection', async (_evt, arg) => {
    const campaignId = arg && typeof arg === 'object' ? arg.campaignId : undefined;
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.show();
      projectionWindow.focus();
      return true;
    }
    projectionWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      // Idealmente querrás fullscreen en el monitor de jugadores
      fullscreenable: true,
      autoHideMenuBar: true,
      title: 'Proyección de mapas',
    });
    const baseDev = 'http://localhost:5173/projection/maps';
    const baseProd = `file://${path.join(__dirname, './frontend/dist/index.html')}#/projection/maps`;
    const startUrl = isDev
      ? (campaignId ? `${baseDev}?campaignId=${encodeURIComponent(campaignId)}` : baseDev)
      : (campaignId ? `${baseProd}?campaignId=${encodeURIComponent(campaignId)}` : baseProd);
    projectionWindow.loadURL(startUrl);
    // Opcional: abrir devtools solo en dev
    // if (isDev) projectionWindow.webContents.openDevTools();
    projectionWindow.on('closed', () => { projectionWindow = null; });
    return true;
  });

  // Crear/mostrar la ventana de proyección Skyline bajo demanda
  ipcMain.handle('skyline:open-projection', async (_evt, arg) => {
    const campaignId = arg && typeof arg === 'object' ? arg.campaignId : undefined;
    if (skylineWindow && !skylineWindow.isDestroyed()) {
      skylineWindow.show();
      skylineWindow.focus();
      return true;
    }
    skylineWindow = new BrowserWindow({
      width: 1280,
      height: 360,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      fullscreenable: true,
      autoHideMenuBar: true,
      title: 'Proyección Skyline',
    });
    const baseDev = 'http://localhost:5173/projection/skyline';
    const baseProd = `file://${path.join(__dirname, './frontend/dist/index.html')}#/projection/skyline`;
    const startUrl = isDev
      ? (campaignId ? `${baseDev}?campaignId=${encodeURIComponent(campaignId)}` : baseDev)
      : (campaignId ? `${baseProd}?campaignId=${encodeURIComponent(campaignId)}` : baseProd);
    skylineWindow.loadURL(startUrl);
    skylineWindow.on('closed', () => { skylineWindow = null; });
    return true;
  });

  // Recoger tamaño de la proyección y reemitirlo a todas las ventanas
  ipcMain.on('maps:projection-size', (_evt, payload) => {
    // broadcast a todas las ventanas (incluida la principal) para espejar
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('maps:projection-size', payload); } catch {}
    }
  });

  // Skyline: recoger tamaño de la proyección y reemitirlo
  ipcMain.on('skyline:projection-size', (_evt, payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('skyline:projection-size', payload); } catch {}
    }
  });

  // Poke para que las ventanas de proyección refresquen del servidor inmediatamente
  ipcMain.on('maps:projection-poke', (_evt, payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('maps:projection-poke', payload); } catch {}
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
