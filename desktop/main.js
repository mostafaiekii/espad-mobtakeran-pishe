// کارگاه‌یار دسکتاپ — پروسه اصلی Electron
// سرور Next.js standalone را به‌صورت پروسه فرعی اجرا می‌کند و پنجره برنامه را نمایش می‌دهد
const { app, BrowserWindow, Menu, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const net = require('net')

// برای تست روی لینوکس می‌توان مسیر resources را دستی داد
const RESOURCES = process.env.KARGAHYAR_RES || process.resourcesPath
const APP_DIR = path.join(RESOURCES, 'app')
const SEED_DB = path.join(RESOURCES, 'seed', 'kargahyar.db')

let win = null
let serverProc = null
let serverPort = 0
let quitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// ── اسپلش راه‌اندازی ──────────────────────────────────────
const splashHtml = (msg) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Vazirmatn,Tahoma,sans-serif;background:#0c0a09;color:#fafaf9;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}
    .box{width:84px;height:84px;border-radius:22px;background:linear-gradient(135deg,#f59e0b,#b45309);display:flex;align-items:center;justify-content:center;animation:pulse 1.6s ease-in-out infinite}
    svg{width:46px;height:46px;fill:#fff}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    .t{font-size:24px;font-weight:800;color:#fbbf24}
    .bar{width:180px;height:4px;border-radius:99px;background:#292524;overflow:hidden}
    .bar i{display:block;height:100%;width:40%;background:#f59e0b;border-radius:99px;animation:slide 1.1s ease-in-out infinite}
    @keyframes slide{0%{transform:translateX(180%)}100%{transform:translateX(-280%)}}
    .m{font-size:13px;color:#a8a29e}
    </style></head><body>
    <div class="box"><svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4.4-1.9-.2a7.7 7.7 0 0 0-.5-1.3l1.2-1.5a1 1 0 0 0-.07-1.32l-1.41-1.41a1 1 0 0 0-1.32-.07l-1.5 1.19a7.7 7.7 0 0 0-1.3-.54L14.4 5.6A1 1 0 0 0 13.41 4.6h-2a1 1 0 0 0-1 .8l-.29 1.9a7.7 7.7 0 0 0-1.3.54L7.3 6.65a1 1 0 0 0-1.32.07L4.57 8.13a1 1 0 0 0-.07 1.32l1.19 1.5a7.7 7.7 0 0 0-.54 1.3l-1.9.29a1 1 0 0 0-.8 1v2a1 1 0 0 0 .8 1l1.9.29a7.7 7.7 0 0 0 .54 1.3l-1.19 1.5a1 1 0 0 0 .07 1.32l1.41 1.41a1 1 0 0 0 1.32.07l1.5-1.19a7.7 7.7 0 0 0 1.3.54l.29 1.9a1 1 0 0 0 1 .8h2a1 1 0 0 0 1-.8l.29-1.9a7.7 7.7 0 0 0 1.3-.54l1.5 1.19a1 1 0 0 0 1.32-.07l1.41-1.41a1 1 0 0 0 .07-1.32l-1.19-1.5a7.7 7.7 0 0 0 .54-1.3l1.9-.29a1 1 0 0 0 .8-1v-2a1 1 0 0 0-.8-1zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg></div>
    <div class="t">کارگاه‌یار</div>
    <div class="bar"><i></i></div>
    <div class="m">${msg}</div>
    </body></html>`
  )

// ── پورت آزاد ────────────────────────────────────────────
function getFreePort() {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => resolve(p))
    })
  })
}

// ── دیتابیس کاربر ─────────────────────────────────────────
function dbFile() {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'kargahyar.db')
  if (!fs.existsSync(dbPath) && fs.existsSync(SEED_DB)) {
    try {
      fs.copyFileSync(SEED_DB, dbPath)
      console.log('[db] seed copied to', dbPath)
    } catch (e) {
      console.error('[db] copy failed', e)
    }
  }
  return dbPath
}

// ── اجرای سرور Next.js ───────────────────────────────────
function startServer(port) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: 'file:' + dbFile().split(path.sep).join('/'),
  }
  serverProc = spawn(process.execPath, [path.join(APP_DIR, 'server.js')], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProc.stdout.on('data', (d) => console.log('[next]', String(d).trim()))
  serverProc.stderr.on('data', (d) => console.error('[next]', String(d).trim()))
  serverProc.on('exit', (code) => {
    console.log('[next] exited with', code)
    serverProc = null
    if (!quitting && win && !win.isDestroyed()) {
      win.loadURL(splashHtml('اتصال با موتور برنامه قطع شد — لطفاً کارگاه‌یار را دوباره باز کنید'))
    }
  })
}

// ── منتظر آماده‌شدن سرور ──────────────────────────────────
function ping() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: serverPort, path: '/api', timeout: 1500 }, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer() {
  for (let i = 0; i < 160; i++) {
    if (await ping()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

// ── راه‌اندازی اصلی ───────────────────────────────────────
async function main() {
  Menu.setApplicationMenu(null)
  if (app.setAppUserModelId) app.setAppUserModelId('ir.kargahyar.desktop')

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: '#0c0a09',
    autoHideMenuBar: true,
    title: 'کارگاه‌یار',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.loadURL(splashHtml('در حال راه‌اندازی موتور برنامه…'))

  // لینک‌های خارجی در مرورگر پیش‌فرض باز شوند
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const port = await getFreePort()
  serverPort = port
  startServer(port)
  const ok = await waitForServer()
  if (ok) {
    await win.loadURL(`http://127.0.0.1:${port}`)
  } else {
    win.loadURL(splashHtml('راه‌اندازی موتور برنامه ناموفق بود — لطفاً دوباره تلاش کنید'))
  }
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
app.on('window-all-closed', () => {
  quitting = true
  app.quit()
})
app.on('before-quit', () => {
  quitting = true
  if (serverProc) {
    try {
      serverProc.kill()
    } catch (e) {
      /* noop */
    }
  }
})
process.on('exit', () => {
  if (serverProc) {
    try {
      serverProc.kill()
    } catch (e) {
      /* noop */
    }
  }
})
app.whenReady().then(main)
