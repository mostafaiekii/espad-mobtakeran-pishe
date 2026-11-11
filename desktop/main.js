// اسپاد مبتکران پیشه دسکتاپ — پروسه اصلی Electron
// سرور Next.js standalone را به‌صورت پروسه فرعی اجرا می‌کند و پنجره برنامه را نمایش می‌دهد.
// مقاوم‌سازی: راه‌اندازی مجدد خودکار موتور، لاگ کامل، صفحات خطای شفاف با دکمه تلاش مجدد.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const net = require('net')

// برای تست روی لینوکس می‌توان مسیر resources را دستی داد
const RESOURCES = process.env.KARGAHYAR_RES || process.env.ESPAD_RES || process.resourcesPath || path.join(__dirname, 'resources')
const APP_DIR = path.join(RESOURCES, 'app')

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
    <div class="t">اسپاد مبتکران پیشه</div>
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
    <div class="t">اسپاد مبتکران پیشه</div>
    <div class="m">${title}</div>
    <div class="sub">${sub}</div>
    <div class="btns">
      <a class="btn retry" href="kargahyar://retry">تلاش مجدد</a>
      <a class="btn quit" href="kargahyar://quit">بستن برنامه</a>
    </div>
    </body></html>`
  )

// ── پورت سرور ─────────────────────────────────────────────
// پورت ثابت ترجیحی تا نیروها بتوانند آدرس را در مرورگر سیستم خودشان ذخیره کنند؛
// اگر اشغال بود، پورت‌های بعدی و در نهایت پورت تصادفی آزاد انتخاب می‌شود.
const PREFERRED_PORTS = [4780, 4781, 4782, 4783, 4784, 4785, 4786, 4787, 4788, 4789]
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '0.0.0.0', () => {
      s.close(() => resolve(true))
    })
  })
}
async function pickPort() {
  for (const p of PREFERRED_PORTS) {
    if (await portFree(p)) return p
  }
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(0, '0.0.0.0', () => {
      const p = s.address().port
      s.close(() => resolve(p))
    })
  })
}

// ── آدرس‌های شبکه برای اتصال سیستم‌های نیروها ──────────
function logLANAddresses(port) {
  try {
    const os = require('os')
    const nets = os.networkInterfaces()
    const urls = []
    for (const addrs of Object.values(nets)) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) {
          urls.push('http://' + a.address + ':' + port)
        }
      }
    }
    if (urls.length > 0) {
      log('[network] آدرس اتصال نیروها: ' + urls.join('  |  '))
    } else {
      log('[network] هیچ کارت شبکه محلی پیدا نشد — فقط دسترسی محلی فعال است')
    }
  } catch (e) {
    log('[network] error: ' + e.message)
  }
}

// ── رمز محلی برای عملیات مدیریتی پوسته ────────────────────
// فقط پوستهٔ Electron (روی سیستم دفتر) این رمز را دارد و به موتور می‌دهد؛
// مرورگرهای نیروها داخل شبکه آن را نمی‌دانند. با آن، مسیر بازیابی
// «بازنشانی حساب مدیر» فقط از خودِ سیستم سرور قابل فراخوانی است.
function localSecret() {
  const p = path.join(app.getPath('userData'), 'local-secret')
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
    const s = require('crypto').randomBytes(24).toString('hex')
    fs.writeFileSync(p, s, 'utf8')
    return s
  } catch (e) {
    log('[secret] failed: ' + e.message)
    return ''
  }
}
let LOCAL_SECRET = ''

// ── دیتابیس کاربر ─────────────────────────────────────────
// در نصب تازه، فایل دیتابیس خالی است؛ جداول هنگام استارت موتور
// به‌صورت خودکار ساخته می‌شوند (instrumentation) — بدون هیچ دادهٔ دمو.
// مهاجرت: اگر کاربر نسخهٔ قبلی (پوشهٔ Espad) دیتابیس داشته باشد،
// به مسیر جدید منتقل می‌شود تا داده‌هایش از دست نرود.
function dbFile() {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'spad.db')
  try {
    if (!fs.existsSync(dbPath)) {
      const oldDir = path.join(path.dirname(dir), 'Espad')
      const oldDb = path.join(oldDir, 'espad.db')
      if (fs.existsSync(oldDb)) {
        fs.copyFileSync(oldDb, dbPath)
        log('[db] مهاجرت دیتابیس از نسخهٔ قبل انجام شد: ' + oldDb + ' → ' + dbPath)
      }
    }
  } catch (e) {
    log('[db] migration failed (non-fatal): ' + e.message)
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
    // 0.0.0.0 = گوش‌دادن روی شبکه محلی؛ سیستم‌های نیروها در LAN می‌توانند وصل شوند
    HOSTNAME: '0.0.0.0',
    DATABASE_URL: 'file:' + dbFile().split(path.sep).join('/'),
    SPAD_LOCAL_SECRET: LOCAL_SECRET,
  }
  log('[engine] spawn on port ' + port + ' (attempt ' + attempts + ')')
  const proc = spawn(process.execPath, [path.join(APP_DIR, 'server.js')], {
    env,
    cwd: APP_DIR,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProc = proc
  proc.stdout.on('data', (d) => log('[next] ' + String(d).trim()))
  proc.stderr.on('data', (d) => log('[next:err] ' + String(d).trim()))
  proc.on('exit', (code) => {
    if (serverProc !== proc) return // پروسه قدیمی — نادیده گرفته شود
    serverProc = null
    log('[engine] exited with code ' + code)
    if (quitting) return
    if (ready) {
      // کرش بعد از راه‌اندازی موفق → راه‌اندازی مجدد خودکار
      ready = false
      restartEngine('اتصال با موتور برنامه قطع شد — در حال راه‌اندازی مجدد…')
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

// ── فراخوانی محلی موتور (فقط از خود سیستم) ───────────────
function postLocal(pathname) {
  return new Promise((resolve) => {
    const body = '{}'
    const req = http.request(
      { host: '127.0.0.1', port: serverPort, path: pathname, method: 'POST', timeout: 5000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length, 'x-local-secret': LOCAL_SECRET } },
      (res) => {
        let raw = ''
        res.on('data', (d) => (raw += d))
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }) }
          catch { resolve({ status: res.statusCode, body: {} }) }
        })
      }
    )
    req.on('error', () => resolve({ status: 0, body: {} }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: {} }) })
    req.write(body)
    req.end()
  })
}

// ── بازنشانی حساب مدیر (بازیابی فراموشی رمز / تعویض مدیر) ─
async function resetManagerFlow() {
  if (!ready) {
    dialog.showMessageBox(win, { type: 'warning', message: 'موتور برنامه هنوز آماده نیست — چند لحظه بعد دوباره تلاش کنید.', buttons: ['باشه'] })
    return
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'حساب مدیر حذف شود؟',
    detail: 'با این کار حساب مدیر فعلی حذف می‌شود و صفحهٔ «راه‌اندازی اولیه» باز می‌شود تا مدیر جدید (یا همان مدیر با اطلاعات جدید) ثبت‌نام کند.\n\n• نیروها و تمام گزارش‌های کاری حفظ می‌شوند\n• این کار فقط از همین سیستم (سیستم دفتر) ممکن است',
    buttons: ['بله، حذف و ثبت‌نام مجدد', 'انصراف'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })
  if (response !== 0) return
  const r = await postLocal('/api/local/reset-manager')
  if (r.status === 200 && r.body && r.body.ok) {
    // نشست ذخیره‌شدهٔ مدیر قبلی پاک شود تا صفحهٔ راه‌اندازی اولیه نمایش داده شود
    try {
      await win.webContents.executeJavaScript("try{localStorage.clear()}catch(e){};true")
    } catch (e) { /* noop */ }
    await win.loadURL('http://127.0.0.1:' + serverPort)
    dialog.showMessageBox(win, {
      type: 'info',
      message: 'حساب مدیر حذف شد ✓',
      detail: 'اکنون در صفحهٔ «راه‌اندازی اولیه کارگاه»، حساب مدیر جدید را با نام، شماره موبایل و رمز جدید ثبت‌نام کنید.',
      buttons: ['باشه'],
      noLink: true,
    })
  } else {
    dialog.showMessageBox(win, {
      type: 'error',
      message: 'بازنشانی انجام نشد',
      detail: 'موتور برنامه در دسترس نبود. برنامه را ببندید و دوباره باز کنید و از منوی بازیابی، دوباره تلاش کنید.',
      buttons: ['باشه'],
      noLink: true,
    })
  }
}

// ── چرخهٔ راه‌اندازی موتور ─────────────────────────────────
async function launchEngine() {
  attempts++
  killServer()
  const port = await pickPort()
  serverPort = port
  startServer(port)
  const ok = await waitForServer(ready ? 20000 : 60000)
  if (ok) {
    ready = true
    attempts = 0
    restarting = false
    log('[engine] ready → loading app UI')
    logLANAddresses(port)
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
      'لطفاً موارد زیر را بررسی کنید:<br>• برنامه را ببندید و دوباره باز کنید<br>• اگر آنتی‌ویروس (Windows Defender یا…) پیام امنیتی نشان داد، گزینهٔ Allow را بزنید و اسپاد مبتکران پیشه را در لیست استثنا قرار دهید<br>• در صورت تکرار، برنامه را حذف و نسخهٔ جدید را دوباره نصب کنید'
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
        'چند تلاش خودکار برای راه‌اندازی مجدد ناموفق بود.<br>لطفاً برنامه را ببندید و دوباره باز کنید؛ اگر تکرار شد، اسپاد مبتکران پیشه را در آنتی‌ویروس ویندوز استثنا کنید.'
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
  if (app.setAppUserModelId) app.setAppUserModelId('ir.spad.desktop')
  LOCAL_SECRET = localSecret()

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: '#0c0a09',
    autoHideMenuBar: true,
    title: 'اسپاد مبتکران پیشه',
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
    } else if (url.startsWith('kargahyar://reset-manager')) {
      e.preventDefault()
      log('[ui] manager reset requested from app window')
      resetManagerFlow()
    } else if (
      url.startsWith('data:') === false &&
      url.startsWith('http://127.0.0.1:') === false &&
      url.startsWith('http://localhost:') === false
    ) {
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
