
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

// Detectar si estamos empaquetados (producción) o en desarrollo.
// app.isPackaged es true cuando la app se ejecuta desde un build de electron-builder.
const isDev = !app.isPackaged;

let projectionWindow = null;
let skylineWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let backendProcess = null;

/* ---------- Logging a archivo (solo producción) ---------- */

/** @type {fs.WriteStream | null} */
let logStream = null;

/**
 * Inicializa el stream de log persistente en userData/backend.log.
 * Se invoca una vez cuando la app está lista.
 */
function initLogFile() {
  if (isDev) return;
  try {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const logPath = path.join(userDataDir, 'backend.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n--- App started at ${new Date().toISOString()} ---\n`);
  } catch { /* si falla, el log va solo a consola */ }
}

/**
 * Escribe un mensaje tanto en consola como en el archivo de log.
 * @param  {...any} args
 */
function log(...args) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  if (logStream) logStream.write(line + '\n');
}

/* ---------- Backend lifecycle ---------- */

/**
 * Realiza un GET a http://localhost:3000/api para comprobar que
 * el backend está escuchando de verdad.
 * @param {number} retries  Número de reintentos (por defecto 10).
 * @param {number} delayMs  Milisegundos entre reintentos (por defecto 500).
 * @returns {Promise<boolean>}
 */
function waitForBackendReady(retries = 10, delayMs = 500) {
  return new Promise((resolve) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      const req = http.get('http://127.0.0.1:3000/api', (res) => {
        log(`[backend] Health-check OK (status ${res.statusCode}) on attempt ${attempt}`);
        res.resume();          // consumir el body para liberar el socket
        resolve(true);
      });
      req.on('error', () => {
        if (attempt < retries) {
          setTimeout(check, delayMs);
        } else {
          log(`[backend] Health-check FAILED after ${retries} attempts`);
          resolve(false);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    check();
  });
}

/**
 * Arranca el servidor NestJS compilado como proceso hijo.
 * Usa ELECTRON_RUN_AS_NODE=1 para que el propio ejecutable de Electron
 * se comporte como un runtime Node.js estándar.
 * @returns {Promise<void>} Se resuelve cuando el backend emite "Application is running"
 *   y el health-check HTTP confirma que responde.
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    const backendDir = path.join(process.resourcesPath, 'backend');
    const entryPoint = path.join(backendDir, 'dist', 'main.js');

    // Ubicar la BD en un directorio con permisos de escritura (userData).
    // En Windows: %APPDATA%/masterhelp-desktop/
    // Esto evita el "Access Denied" al instalar en C:\Program Files.
    const userDataDir = app.getPath('userData');
    const dbPath = path.join(userDataDir, 'dm_app.db');

    // Si la BD de producción no existe aún, intentar copiar la BD semilla
    // empaquetada en resources/backend/data/ para conservar datos previos.
    if (!fs.existsSync(dbPath)) {
      const seedDb = path.join(backendDir, 'data', 'dm_app.db');
      if (fs.existsSync(seedDb)) {
        try {
          if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
          }
          fs.copyFileSync(seedDb, dbPath);
          log('[backend] Seed DB copied from resources to userData:', dbPath);
        } catch (copyErr) {
          log('[backend] Could not copy seed DB, starting fresh:', copyErr.message);
        }
      } else {
        log('[backend] No seed DB found at', seedDb, '— starting with empty database');
      }
    }

    log('[backend] Starting...', { backendDir, entryPoint, dbPath, execPath: process.execPath });

    // Verificar que el entry-point existe
    if (!fs.existsSync(entryPoint)) {
      const msg = `[backend] Entry-point NOT FOUND: ${entryPoint}`;
      log(msg);
      reject(new Error(msg));
      return;
    }

    backendProcess = spawn(process.execPath, [entryPoint], {
      cwd: backendDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        DB_TYPE: 'sqlite',
        DB_DATABASE: dbPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;

    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      log('[backend:out]', msg.trimEnd());
      if (!started && msg.includes('Application is running')) {
        started = true;
        // Confirmar con health-check HTTP antes de resolver
        waitForBackendReady().then((ok) => {
          if (ok) {
            log('[backend] Ready and verified via health-check');
          } else {
            log('[backend] stdout said running but health-check failed');
          }
          resolve();
        });
      }
    });

    backendProcess.stderr.on('data', (data) => {
      log('[backend:err]', data.toString().trimEnd());
    });

    backendProcess.on('error', (err) => {
      log('[backend] Failed to start:', err.message);
      if (!started) reject(err);
    });

    backendProcess.on('exit', (code) => {
      log('[backend] Exited with code', String(code));
      backendProcess = null;
      if (!started) reject(new Error(`Backend exited with code ${code}`));
    });

    // Timeout de seguridad: si en 30 s no arranca, continuar igual
    setTimeout(() => {
      if (!started) {
        started = true;
        log('[backend] Timeout esperando arranque, continuando...');
        resolve();
      }
    }, 30_000);
  });
}

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
    : `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  // Abrir las DevTools en modo de desarrollo (opcional).
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Este método se llamará cuando Electron haya terminado la inicialización.
app.whenReady().then(async () => {
  initLogFile();

  // Arrancar el backend en producción antes de mostrar la ventana
  try {
    await startBackend();
  } catch (err) {
    log('[startup] No se pudo arrancar el backend:', err?.message ?? err);
    // Informar al usuario con un diálogo nativo
    dialog.showErrorBox(
      'MasterHelp – Error al iniciar',
      `No se pudo arrancar el servidor interno.\n\n${err?.message ?? err}\n\nRevisa el log en:\n${path.join(app.getPath('userData'), 'backend.log')}`,
    );
  }

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
    const baseDev = 'http://localhost:5173/#/projection/maps';
    const baseProd = `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}#/projection/maps`;
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
    const baseDev = 'http://localhost:5173/#/projection/skyline';
    const baseProd = `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}#/projection/skyline`;
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

// Limpiar proceso backend al salir
app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
