const { app, BrowserWindow } = require('electron');
const path = require('path');

// Determinar si estamos en modo de desarrollo
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  // Crear la ventana del navegador.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // En un entorno de producción, es recomendable deshabilitar nodeIntegration
      // y usar un preload script para exponer APIs de forma segura.
      nodeIntegration: false, // Es más seguro
      contextIsolation: true, // Protege contra scripts maliciosos
    },
  });

  // Cargar la URL del frontend.
  // En desarrollo, carga el servidor de Vite. En producción, cargaría el archivo estático.
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, './frontend/dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Abrir las DevTools en modo de desarrollo (desactivado).
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Este método se llamará cuando Electron haya terminado
// la inicialización y esté listo para crear ventanas del navegador.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // En macOS, es común volver a crear una ventana en la aplicación cuando el
    // icono del dock se hace clic y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});