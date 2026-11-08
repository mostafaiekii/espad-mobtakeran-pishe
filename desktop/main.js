// کارگاه‌یار دسکتاپ — پروسه اصلی Electron
// سرور Next.js standalone را به‌صورت پروسه فرعی اجرا می‌کند و پنجره برنامه را نمایش می‌دهد.
// مقاوم‌سازی: راه‌اندازی مجدد خودکار موتور، لاگ کامل، صفحات خطای شفاف با دکمه تلاش مجدد.
const { app, BrowserWindow, Menu, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const net = require('net')

// برای تست روی لینوکس می‌توان مسیر resources را دستی داد
const RESOURCES = process.env.KARGAHYAR_RES || process.resourcesPath || path.join(__dirname, 'resources')
const APP_DIR = path.join(RESOURCES, 'app')
const SEED_DB = path.join(RESOURCES, 'seed', 'kargahyar.db')

const MAX_ATTEMPTS = 3 // حداکثر تلاش‌های متوالی ناموفق
const RESTART_DELAY = 1500

let win = null
let serverProc = null
let serverPort = 0
let quitting = false
let ready = false // سرور حداقل یک‌بار پاسخ داده است
let attempts = 0 // تلاش‌های متوالی ناموفق
let restarting = false
let logFd = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// ── لاگ موتور ─────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    if (!logFd) {
      const dir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(dir, { recursive: true })
      logFd = path.join(dir, 'engine.log')
      // جلوگیری از بی‌نهایت شدن لاگ
      try {
        const st = fs.statSync(logFd)
        if (st.size > 2 * 1024 * 1024) fs.writeFileSync(logFd, '')
      } catch (e) {
        /* فایل هنوز وجود ندارد */
      }
    }
    fs.appendFileSync(logFd, line + '\n')
  } catch (e) {
    /* لاگ نباید اجرای برنامه را مختل کند */
  }
}

// ── صفحات HTML داخلی ──────────────────────────────────────
const pageStyle = `
  body{margin:0;font-family:Vazirmatn,Tahoma,sans-serif;background:#0c0a09;color:#fafaf9;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}
  .box{width:84px;height:84px;border-radius:22px;background:linear-gradient(135deg,#f59e0b,#b45309);display:flex;align-items:center;justify-content:center;animation:pulse 1.6s ease-in-out infinite}
  svg{width:46px;height:46px;fill:#fff}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  .t{font-size:24px;font-weight:800;color:#fbbf24}
  .bar{width:180px;height:4px;border-radius:99px;background:#292524;overflow:hidden}
  .bar i{display:block;height:100%;width:40%;background:#f59e0b;border-radius:99px;animation:slide 1.1s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(180%)}100%{transform:translateX(-280%)}}
  .m{font-size:14px;color:#e7e5e4;text-align:center;max-width:520px;line-height:1.9;padding:0 24px}
  .sub{font-size:12.5px;color:#a8a29e;text-align:center;max-width:560px;line-height:2;padding:0 24px}
  .btns{display:flex;gap:12px;margin-top:8px}
  a.btn{display:inline-block;padding:10px 26px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer}
  .retry{background:#f59e0b;color:#1c1917}
  .quit{background:#292524;color:#e7e5e4}
`

const splashHtml = (msg) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>${pageStyle}</style></head><body>
    <div class="box"><svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4.4-1.9-.2a7.7 7.7 0 0 0-.5-1.3l1.2-1.5a1 1 0 0 0-.07-1.32l-1.41-1.41a1 1 0 0 0-1.32-.07l-1.5 1.19a7.7 7.7 0 0 0-1.3-.54L14.4 5.6A1 1 0 0 0 13.41 4.6h-2a1 1 0 0 0-1 .8l-.29 1.9a7.7 7.7 0 0 0-1.3.54L7.3 6.65a1 1 0 0 0-1.32.07L4.57 8.13a1 1 0 0 0-.07 1.32l1.19 1.5a7.7 7.7 0 0 0-.54 1.3l-1.9.29a1 1 0 0 0-.8 1v2a1 1 0 0 0 .8 1l1.9.29a7.7 7.7 0 0 0 .54 1.3l-1.19 1.5a1 1 0 0 0 .07 1.32l1.41 1.41a1 1 0 0 0 1.32.07l1.5-1.19a7.7 7.7 0 0 0 1.3.54l.29 1.9a1 1 0 0 0 1 .8h2a1 1 0 0 0 1-.8l.29-1.9a7.7 7.7 0 0 0 1.3-.54l1.5 1.19a1 1 0 0 0 1.32-.07l1.41-1.41a1 1 0 0 0 .07-1.32l-1.19-1.5a7.7 7.7 0 0 0 .54-1.3l1.9-.29a1 1 0 0 0 .8-1v-2a1 1 0 0 0-.8-1zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg></div>
    <div class="t">کارگاه‌یار</div>
    <div class="bar"><i></i></div>
    <div class="m">${msg}</div>
    </body></html>`
  )

const errorHtml = (title, sub) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>${pageStyle}
     .box,.box svg{animation:none}</style></head><body>
    <div class="box"><svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4.4-1.9-.2a7.7 7.7 0 0 0-.5-1.3l1.2-1.5a1 1 0 0 0-.07-1.32l-1.41-1.41a1 1 0 0 0-1.32-.07l-1.5 1.19a7.7 7.7 0 0 0-1.3-.54L14.4 5.6A1 1 0 0 0 13.41 4.6h-2a1 1 0 0 0-1 .8l-.29 1.9a7.7 7.7 0 0 0-1.3.54L7.3 6.65a1 1 0 0 0-1.32.07L4.57 8.13a1 1 0 0 0-.07 1.32l1.19 1.5a7.7 7.7 0 0 0-.54 1.3l-1.9.29a1 1 0 0 0-.8 1v2a1 1 0 0 0 .8 1l1.9.29a7.7 7.7 0 0 0 .54 1.3l-1.19 1.5a1 1 0 0 0 .07 1.32l1.41 1.41a1 1 0 0 0 1.32.07l1.5-1.19a7.7 7.7 0 0 0 1.3.54l.29 1.9a1 1 0 0 0 1 .8h2a1 1 0 0 0 1-.8l.29-1.9a7.7 7.7 0 0 0 1.3-.54l1.5 1.19a1 1 0 0 0 1.32-.07l1.41-1.41a1 1 0 0 0 .07-1.32l-1.19-1.5a7.7 7.7 0 0 0 .54-1.3l1.9-.29a1 1 0 0 0 .8-1v-2a1 1 0 0 0-.8-1zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg></div>
    <div class="t">کارگاه‌یار</div>
    <div class="m">${title}</div>
    <div class="sub">${sub}</div>
    <div class="btns">
      <a class="btn retry" href="kargahyar://retry">تلاش مجدد</a>
      <a class="btn quit" href="kargahyar://quit">بستن برنامه</a>
    </div>
    </body></html>`
  )

// ── پورت آزاد ─────────────────────────────────────────────
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
      log('[db] seed copied to ' + dbPath)
    } catch (e) {
      log('[db] copy failed: ' + e.message)
    }
  }
  return dbPath
}

// ── اجرای سرور Next.js ───────────────────────────────────
function killServer() {
  if (serverProc) {
    try {
      serverProc.kill()
    } catch (e) {
      /* noop */
    }
    serverProc = null
  }
}

function startServer(port) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    NODE_OPTIONS: '',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: 'file:' + dbFile().split(path.sep).join('/'),
  }
  log('[engine] spawn on port ' + port + ' (attempt ' + attempts + ')')
  serverProc = spawn(process.execPath, [path.join(APP_DIR, 'server.js')], {
    env,
    cwd: APP_DIR,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProc.stdout.on('data', (d) => log('[next] ' + String(d).trim()))
  serverProc.stderr.on('data', (d) => log('[next:err] ' + String(d).trim()))
  serverProc.on('exit', (code) => {
    log('[engine] exited with code ' + code)
    if (serverProc === null) return // بعد از killServer عمدی
    serverProc = null
    if (quitting) return
    if (ready) {
      // کرش بعد از راه‌اندازی موفق → راه‌اندازی مجدد خودکار
      ready = false
      restartEngine('اتصال با موتور برنامه قطع شد — در حال راه‌اندازی مجدد…')
    } else if (!restarting) {
      // ناموفق در همین تلاش → حلقهٔ retry توسط waitForServer مدیریت می‌شود
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

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

// ── چرخهٔ راه‌اندازی موتور ─────────────────────────────────
async function launchEngine() {
  attempts++
  killServer()
  const port = await getFreePort()
  serverPort = port
  startServer(port)
  const ok = await waitForServer(ready ? 20000 : 60000)
  if (ok) {
    ready = true
    attempts = 0
    restarting = false
    log('[engine] ready → loading app UI')
    await win.loadURL('http://127.0.0.1:' + port)
    return
  }
  killServer()
  if (attempts < MAX_ATTEMPTS) {
    log('[engine] start failed, retrying (' + attempts + '/' + MAX_ATTEMPTS + ')')
    win.loadURL(splashHtml('راه‌اندازی موتور کمی طول کشید — تلاش مجدد ' + attempts + ' از ' + MAX_ATTEMPTS + '…'))
    await new Promise((r) => setTimeout(r, RESTART_DELAY))
    return launchEngine()
  }
  attempts = 0
  log('[engine] giving up after ' + MAX_ATTEMPTS + ' attempts')
  win.loadURL(
    errorHtml(
      'راه‌اندازی موتور برنامه ناموفق بود',
      'لطفاً موارد زیر را بررسی کنید:<br>• برنامه را ببندید و دوباره باز کنید<br>• اگر آنتی‌ویروس (Windows Defender یا…) پیام امنیتی نشان داد، گزینهٔ Allow را بزنید و کارگاه‌یار را در لیست استثنا قرار دهید<br>• در صورت تکرار، برنامه را حذف و نسخهٔ جدید را دوباره نصب کنید'
    )
  )
}

function restartEngine(splashMsg) {
  if (quitting) return
  if (attempts >= MAX_ATTEMPTS) {
    attempts = 0
    ready = false
    win.loadURL(
      errorHtml(
        'اتصال با موتور برنامه قطع شد',
        'چند تلاش خودکار برای راه‌اندازی مجدد ناموفق بود.<br>لطفاً برنامه را ببندید و دوباره باز کنید؛ اگر تکرار شد، کارگاه‌یار را در آنتی‌ویروس ویندوز استثنا کنید.'
      )
    )
    return
  }
  restarting = true
  win.loadURL(splashHtml(splashMsg || 'در حال راه‌اندازی مجدد موتور برنامه…'))
  setTimeout(() => launchEngine(), RESTART_DELAY)
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

  // لینک‌های خارجی در مرورگر پیش‌فرض باز شوند + دکمه‌های صفحهٔ خطا
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('kargahyar://retry')) {
      e.preventDefault()
      log('[ui] retry requested by user')
      attempts = 0
      ready = false
      restarting = true
      win.loadURL(splashHtml('در حال راه‌اندازی مجدد موتور برنامه…'))
      setTimeout(() => launchEngine(), RESTART_DELAY)
    } else if (url.startsWith('kargahyar://quit')) {
      e.preventDefault()
      app.quit()
    } else if (url.startsWith('data:') === false && url.startsWith('http://127.0.0.1:') === false) {
      e.preventDefault()
    }
  })

  // اگر رندرر کرش کرد، صفحه دوباره بارگذاری شود
  win.webContents.on('render-process-gone', () => {
    log('[renderer] gone — reloading')
    if (ready && win && !win.isDestroyed()) win.reload()
  })

  log('[app] starting — resources: ' + RESOURCES)
  log('[app] server.js exists: ' + fs.existsSync(path.join(APP_DIR, 'server.js')))
  await launchEngine()
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
  killServer()
})
process.on('exit', () => {
  quitting = true
  killServer()
})
app.whenReady().then(main)
