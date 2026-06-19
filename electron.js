
const { app, BrowserWindow, ipcMain, dialog, Menu, session, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Detectar si estamos empaquetados (producción) o en desarrollo.
// app.isPackaged es true cuando la app se ejecuta desde un build de electron-builder.
const isDev = !app.isPackaged;

let mainWindow = null;
let projectionWindow = null;
let skylineWindow = null;
let splashWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let backendProcess = null;
/** @type {import('http').Server | null} */
let staticServer = null;

/**
 * Runtime registry of app windows used by shortcut window targeting.
 * Key format: main | splash | projection | skyline | dynamic webContents IDs.
 * @type {Map<string, { id: string; kind: string; title: string; campaignId: string | null; webContentsId: number; createdAt: string }>} 
 */
const windowRegistry = new Map();

/**
 * Registers or refreshes window metadata in the runtime registry.
 * @param {string} id
 * @param {BrowserWindow} win
 * @param {string} kind
 * @param {string | null} campaignId
 */
function registerWindow(id, win, kind, campaignId = null) {
  if (!win || win.isDestroyed()) return;
  windowRegistry.set(id, {
    id,
    kind,
    title: win.getTitle() || kind,
    campaignId,
    webContentsId: win.webContents.id,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Removes a window from the runtime registry by logical id.
 * @param {string} id
 */
function unregisterWindow(id) {
  if (!id) return;
  windowRegistry.delete(id);
}

/**
 * Returns serializable entries for current alive windows.
 * @returns {Array<{ id: string; kind: string; title: string; campaignId: string | null; webContentsId: number; createdAt: string }>}
 */
function listRegisteredWindows() {
  const allWindows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  const byWebContentsId = new Set(allWindows.map((win) => win.webContents.id));

  for (const [id, meta] of windowRegistry.entries()) {
    if (!byWebContentsId.has(meta.webContentsId)) {
      windowRegistry.delete(id);
    }
  }

  return Array.from(windowRegistry.values());
}

/** Duración del fade-out del splash en milisegundos. */
const SPLASH_FADE_OUT_MS = 180;
/** Tiempo máximo para esperar ready-to-show de la ventana principal. */
const MAIN_WINDOW_READY_TIMEOUT_MS = 15_000;

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

/**
 * Resuelve la ruta absoluta de un asset dentro de frontend/src/assets.
 * En builds empaquetados funciona porque se incluye explícitamente en electron-builder.
 * @param {string} filename
 * @returns {string}
 */
function getFrontendSourceAssetPath(filename) {
  return path.join(__dirname, 'frontend', 'src', 'assets', filename);
}

/**
 * Maximum width (px) used when embedding the splash image as a data URI.
 * Large source images (several MB) must be downscaled, otherwise the base64
 * data URL exceeds Chromium's navigation size limit and the splash renders
 * blank.
 */
const SPLASH_IMAGE_MAX_WIDTH = 960;

/**
 * Resuelve el data URI del splash leyendo StartApp.png desde rutas candidatas.
 * La imagen se decodifica y reescala con `nativeImage` para mantener el data
 * URI ligero sin importar el tamaño del archivo original.
 * Si no se encuentra (o no se puede decodificar), devuelve null para renderizar
 * un fallback textual.
 * @returns {string | null}
 */
function getSplashImageDataUri() {
  const candidates = [
    path.join(__dirname, 'frontend', 'src', 'assets', 'StartApp.png'),
    path.join(__dirname, 'frontend', 'dist', 'assets', 'StartApp.png'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;

      let image = nativeImage.createFromPath(candidate);
      if (image.isEmpty()) {
        log('[splash] nativeImage could not decode image:', candidate);
        continue;
      }

      const { width } = image.getSize();
      if (width > SPLASH_IMAGE_MAX_WIDTH) {
        image = image.resize({ width: SPLASH_IMAGE_MAX_WIDTH });
      }

      log('[splash] Using splash image:', candidate);
      return image.toDataURL();
    } catch (err) {
      log('[splash] Failed reading splash image:', candidate, err?.message ?? err);
    }
  }

  log('[splash] StartApp.png not found in expected paths');
  return null;
}

/**
 * Crea y muestra la ventana splash para dar feedback visual inmediato en el arranque.
 * @returns {BrowserWindow}
 */
function createSplashWindow() {
  const splashImageDataUri = getSplashImageDataUri();
  const splashBody = splashImageDataUri
    ? `<img src="${splashImageDataUri}" alt="MasterHelp" />`
    : '<div class="fallback">Iniciando MasterHelp...</div>';

  const splashHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: file:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MasterHelp Starting</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f1115;
        overflow: hidden;
      }
      .wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .fallback {
        color: #f2f4f8;
        font-family: Segoe UI, Tahoma, sans-serif;
        font-size: 22px;
        letter-spacing: 0.3px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${splashBody}
    </div>
  </body>
</html>`;

  const splash = new BrowserWindow({
    width: 960,
    height: 540,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#0f1115',
    alwaysOnTop: true,
    center: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`);
  registerWindow('splash', splash, 'splash', null);
  splash.on('closed', () => {
    unregisterWindow('splash');
    splashWindow = null;
  });
  return splash;
}

/**
 * Realiza un cierre suave del splash reduciendo su opacidad gradualmente.
 * @param {BrowserWindow | null} targetSplash
 * @param {number} durationMs
 * @returns {Promise<void>}
 */
function fadeOutAndCloseSplash(targetSplash, durationMs = SPLASH_FADE_OUT_MS) {
  return new Promise((resolve) => {
    if (!targetSplash || targetSplash.isDestroyed()) {
      resolve();
      return;
    }

    const steps = 10;
    const intervalMs = Math.max(16, Math.floor(durationMs / steps));
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep += 1;
      const nextOpacity = Math.max(0, 1 - (currentStep / steps));

      if (!targetSplash.isDestroyed()) {
        targetSplash.setOpacity(nextOpacity);
      }

      if (currentStep >= steps) {
        clearInterval(interval);
        if (!targetSplash.isDestroyed()) {
          targetSplash.close();
        }
        resolve();
      }
    }, intervalMs);
  });
}

/* ---------- Frontend static server (producción) ---------- */

/**
 * Tipos MIME básicos para el servidor estático del frontend.
 * @type {Record<string, string>}
 */
const STATIC_MIME_TYPES = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.mp3':   'audio/mpeg',
  '.ogg':   'audio/ogg',
  '.wav':   'audio/wav',
};

/** Puerto en el que el servidor estático escuchará en producción. */
const STATIC_FRONTEND_PORT = 5173;

/**
 * Arranca un servidor HTTP estático que sirve `frontend/dist` en el puerto
 * {@link STATIC_FRONTEND_PORT}, escuchando en todas las interfaces (0.0.0.0).
 *
 * Esto permite que otros equipos de la misma red LAN accedan a la app
 * mediante un navegador usando la URL mostrada en los ajustes (Acceso Web).
 *
 * Solo se ejecuta cuando la app está empaquetada (producción).
 * Electron parchea `fs.readFile` para leer dentro del archivo .asar,
 * por lo que el servidor funciona aunque `frontend/dist` esté empaquetado.
 *
 * @returns {import('http').Server | null} El servidor creado, o null en dev.
 */
function startStaticServer() {
  if (isDev) return null;

  const staticDir = path.join(__dirname, 'frontend', 'dist');
  const indexPath = path.join(staticDir, 'index.html');

  const server = http.createServer((req, res) => {
    // Extraer el path sin query string ni fragmento
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);

    // Seguridad: rechazar path traversal
    const normalized = path.normalize(rawPath);
    if (normalized.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Resolver la ruta al fichero estático
    const filePath = path.join(staticDir, normalized);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fallback SPA: servir index.html para cualquier ruta no encontrada
        fs.readFile(indexPath, (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexData);
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(STATIC_FRONTEND_PORT, '0.0.0.0', () => {
    log(`[static] Frontend accesible en http://0.0.0.0:${STATIC_FRONTEND_PORT}`);
  });

  server.on('error', (err) => {
    log('[static] Error en el servidor estático:', err.message);
  });

  return server;
}

/* ---------- Backend lifecycle ---------- */

/**
 * Realiza un GET a http://localhost:3000/api para comprobar que
 * el backend está escuchando de verdad.
 * @param {number} retries  Número de reintentos (por defecto 10).
 * @param {number} delayMs  Milisegundos entre reintentos (por defecto 500).
 * @returns {Promise<boolean>}
 */
function waitForBackendReady(retries = 30, delayMs = 1000) {
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
    let settled = false;

    /** @param {Error | null} error */
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

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
          finish();
        });
      }
    });

    backendProcess.stderr.on('data', (data) => {
      log('[backend:err]', data.toString().trimEnd());
    });

    backendProcess.on('error', (err) => {
      log('[backend] Failed to start:', err.message);
      if (!started) finish(err);
    });

    backendProcess.on('exit', (code) => {
      log('[backend] Exited with code', String(code));
      backendProcess = null;
      if (!started) finish(new Error(`Backend exited with code ${code}`));
    });

    // Timeout de seguridad: si en 90 s no arranca, continuar igualmente.
    // El cold-start en Windows (creación de BD, antivirus, caché frío) puede
    // superar los 30 s fácilmente en la primera ejecución.
    setTimeout(() => {
      if (!started && !settled) {
        log('[backend] Timeout esperando arranque (90s) — se continúa de todas formas');
        // Resolver en vez de rechazar: el backend puede terminar de arrancar
        // un poco después y la app funcionará igualmente.
        finish();
      }
    }, 90_000);
  });
}

/* ---------- Content Security Policy ---------- */

/** Orígenes locales del backend NestJS a los que el renderer hace fetch/stream. */
const BACKEND_ORIGINS = 'http://localhost:3000 http://127.0.0.1:3000';

/**
 * Construye la cadena de Content-Security-Policy para el renderer.
 *
 * En producción se aplica una política estricta (sin `unsafe-eval`).
 * En desarrollo se relaja `script-src` y `connect-src` porque Vite necesita
 * `unsafe-eval`/`unsafe-inline` para el HMR y un WebSocket para recargar módulos.
 *
 * @param {boolean} dev - `true` cuando la app corre en modo desarrollo.
 * @returns {string} Valor para la cabecera `Content-Security-Policy`.
 */
function buildContentSecurityPolicy(dev) {
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";

  const connectSrc = dev
    ? `connect-src 'self' ${BACKEND_ORIGINS} ws://localhost:5173 http://localhost:5173`
    : `connect-src 'self' ${BACKEND_ORIGINS}`;

  return [
    "default-src 'self'",
    scriptSrc,
    // MUI/Emotion inyecta estilos inline; Google Fonts sirve hojas de estilo remotas.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${BACKEND_ORIGINS}`,
    `media-src 'self' blob: ${BACKEND_ORIGINS}`,
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/**
 * Registra un interceptor que añade la cabecera `Content-Security-Policy`
 * a todas las respuestas del renderer, eliminando la advertencia de seguridad
 * de Electron y reduciendo la superficie de ataque (XSS, inyección de scripts).
 */
function setupContentSecurityPolicy() {
  const csp = buildContentSecurityPolicy(isDev);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function createWindow() {
  // Ocultar el menú por defecto (File, Edit, View, etc.)
  Menu.setApplicationMenu(null);

  // Crear la ventana del navegador (frameless para barra de título custom).
  const appIconPath = getFrontendSourceAssetPath('Logo-app.ico');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MasterHelp',
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    frame: false,
    show: false,
    backgroundColor: '#0f1115',
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
  registerWindow('main', mainWindow, 'main', null);
  mainWindow.on('closed', () => {
    unregisterWindow('main');
    mainWindow = null;
  });

  // Abrir las DevTools en modo de desarrollo (opcional).
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Este método se llamará cuando Electron haya terminado la inicialización.
app.whenReady().then(async () => {
  const startupStartedAt = Date.now();
  initLogFile();

  // Aplicar la política de seguridad de contenido antes de cargar contenido.
  setupContentSecurityPolicy();

  splashWindow = createSplashWindow();
  log('[startup] Splash shown at', `${Date.now() - startupStartedAt}ms`);

  // Arrancar el servidor estático del frontend (Acceso Web por LAN)
  staticServer = startStaticServer();

  // Arrancar el backend en producción antes de mostrar la ventana
  try {
    await startBackend();
    log('[startup] Backend ready at', `${Date.now() - startupStartedAt}ms`);
  } catch (err) {
    log('[startup] No se pudo arrancar el backend:', err?.message ?? err);
    // Continuar sin bloquear: intentar un último health-check antes de
    // mostrar el diálogo de error. El backend puede haber terminado de
    // arrancar justo después del timeout.
    const lastChance = await waitForBackendReady(10, 1000);
    if (lastChance) {
      log('[startup] Backend respondió tras timeout inicial — continuando');
    } else {
      log('[startup] Backend sigue sin responder — mostrando error');
      dialog.showErrorBox(
        'MasterHelp – Error al iniciar',
        `No se pudo arrancar el servidor interno.\n\n${err?.message ?? err}\n\nRevisa el log en:\n${path.join(app.getPath('userData'), 'backend.log')}`,
      );
    }
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

  const revealMainWindow = async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      log('[startup] Main window ready-to-show at', `${Date.now() - startupStartedAt}ms`);
    }
    await fadeOutAndCloseSplash(splashWindow, SPLASH_FADE_OUT_MS);
  };

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      void revealMainWindow();
    });

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        log('[startup] Main window ready-to-show timeout; forcing visible window');
        void revealMainWindow();
      }
    }, MAIN_WINDOW_READY_TIMEOUT_MS);
  }

  // Controles de ventana personalizados (minimizar, maximizar, cerrar)
  ipcMain.on('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });
  ipcMain.on('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });
  ipcMain.handle('window:is-maximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
  });

  // Controles de app: recargar, devtools, zoom
  ipcMain.on('app:reload', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
  });
  ipcMain.on('app:toggle-devtools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.toggleDevTools();
  });
  ipcMain.on('app:zoom-in', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const wc = mainWindow.webContents;
      wc.setZoomLevel(wc.getZoomLevel() + 0.5);
    }
  });
  ipcMain.on('app:zoom-out', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const wc = mainWindow.webContents;
      wc.setZoomLevel(wc.getZoomLevel() - 0.5);
    }
  });
  ipcMain.on('app:zoom-reset', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomLevel(0);
    }
  });

  // Emitir cambio de estado maximizado al renderer
  if (mainWindow) {
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window:maximized-changed', true);
    });
    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window:maximized-changed', false);
    });
  }

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
    registerWindow('projection', projectionWindow, 'projection', campaignId || null);
    // Opcional: abrir devtools solo en dev
    // if (isDev) projectionWindow.webContents.openDevTools();
    projectionWindow.on('closed', () => {
      unregisterWindow('projection');
      projectionWindow = null;
    });
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
    registerWindow('skyline', skylineWindow, 'skyline', campaignId || null);
    skylineWindow.on('closed', () => {
      unregisterWindow('skyline');
      skylineWindow = null;
    });
    return true;
  });

  ipcMain.handle('shortcuts:list-windows', async () => {
    return listRegisteredWindows();
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

  /**
   * Resolves a set of windows from a shortcut action target descriptor.
   * Supported values: main, projection, skyline, all, custom title, numeric webContents id.
   */
  const resolveShortcutTargetWindows = (target) => {
    const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
    if (!target || target === 'all') return windows;
    if (target === 'main') return mainWindow && !mainWindow.isDestroyed() ? [mainWindow] : [];
    if (target === 'projection') return projectionWindow && !projectionWindow.isDestroyed() ? [projectionWindow] : [];
    if (target === 'skyline') return skylineWindow && !skylineWindow.isDestroyed() ? [skylineWindow] : [];

    const byWebContentsId = Number(target);
    if (!Number.isNaN(byWebContentsId)) {
      return windows.filter((win) => win.webContents.id === byWebContentsId);
    }

    const registryMatch = Array.from(windowRegistry.values()).find((meta) => meta.id === String(target));
    if (registryMatch) {
      return windows.filter((win) => win.webContents.id === registryMatch.webContentsId);
    }

    return windows.filter((win) => {
      try {
        return String(win.getTitle() || '').toLowerCase() === String(target).toLowerCase();
      } catch {
        return false;
      }
    });
  };

  ipcMain.handle('shortcuts:dispatch-window-action', async (_evt, payload) => {
    const target = payload && typeof payload === 'object' ? payload.target : undefined;
    const enrichedPayload = payload && typeof payload === 'object'
      ? { ...payload, dispatchedAtMs: Date.now() }
      : payload;
    const windows = resolveShortcutTargetWindows(target);
    for (const win of windows) {
      try {
        win.webContents.send('shortcuts:window-action', enrichedPayload);
      } catch {}
    }
    return { delivered: windows.length };
  });

  // ── Auto-updater ──────────────────────────────────────────────────────────
  // Solo activo en builds empaquetados (producción). En dev se ignora para
  // evitar llamadas a GitHub sin artefactos publicados.
  if (!isDev) {
    /**
     * Reenvía un evento de actualización a la ventana principal.
     * @param {string} channel - Canal IPC del renderer.
     * @param {any} payload - Datos del evento.
     */
    const sendUpdate = (channel, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
      }
    };

    // No descargar automáticamente: el usuario decide cuándo hacerlo.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      log('[updater] Comprobando actualizaciones...');
      sendUpdate('updater:checking', null);
    });

    autoUpdater.on('update-available', (info) => {
      log('[updater] Actualización disponible:', info.version);
      sendUpdate('updater:available', { version: info.version, releaseDate: info.releaseDate });
    });

    autoUpdater.on('update-not-available', (info) => {
      log('[updater] Sin actualizaciones. Versión actual:', info.version);
      sendUpdate('updater:not-available', { version: info.version });
    });

    autoUpdater.on('download-progress', (progress) => {
      log(`[updater] Descargando... ${Math.round(progress.percent)}%`);
      sendUpdate('updater:progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log('[updater] Descarga completada:', info.version);
      sendUpdate('updater:downloaded', { version: info.version });
    });

    autoUpdater.on('error', (err) => {
      log('[updater] Error:', err?.message ?? err);
      sendUpdate('updater:error', { message: err?.message ?? String(err) });
    });

    /** Comproba si hay una nueva versión disponible en GitHub Releases. */
    ipcMain.handle('updater:check', async () => {
      try {
        await autoUpdater.checkForUpdates();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err?.message ?? String(err) };
      }
    });

    /** Inicia la descarga de la actualización disponible. */
    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err?.message ?? String(err) };
      }
    });

    /** Cierra la app e instala la actualización descargada. */
    ipcMain.on('updater:install', () => {
      autoUpdater.quitAndInstall(false, true);
    });
  } else {
    // En desarrollo: devolver respuestas stub para no romper la UI.
    ipcMain.handle('updater:check', async () => ({ ok: false, error: 'dev-mode' }));
    ipcMain.handle('updater:download', async () => ({ ok: false, error: 'dev-mode' }));
    ipcMain.on('updater:install', () => {});
  }
  // ─────────────────────────────────────────────────────────────────────────

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Limpiar proceso backend y servidor estático al salir
app.on('before-quit', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
