// مونتاژ قطعی و کامل «موتور برنامه» برای بستهٔ Electron اسپاد مبتکران پیشه
// ─────────────────────────────────────────────────────────────
// مشکل ریشه‌ای: خروجی standalone در Next.js 16 (بیلد Turbopack) روی بعضی
// محیط‌ها (مانند رانر ویندوز گیت‌هاب + bun) پوشهٔ node_modules را کپی نمی‌کند
// → سرور داخلی بلافاصله بعد از require('next') کرش می‌کند.
// راه‌حل: node_modules زمان اجرا را به‌صورت صریح با npm و نسخه‌های پین‌شدهٔ
// دقیق می‌سازیم (next + react + react-dom + @prisma/client + client-only)
// و کلاینت تولیدشدهٔ Prisma به‌همراه موتور ویندوز را دستی کپی می‌کنیم.
// این اسکریپت کراس‌پلتفرم است (ویندوز/لینوکس/مک).

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')
const desktopDir = path.join(root, 'desktop')
const appDir = path.join(desktopDir, 'resources', 'app')

function log(msg) {
  console.log('[assemble-desktop]', msg)
}

function fatal(msg) {
  console.error('[assemble-desktop] ✖ خطا:', msg)
  process.exit(1)
}

function readVersion(pkgName) {
  const pkgPath = path.join(root, 'node_modules', pkgName, 'package.json')
  if (!fs.existsSync(pkgPath)) fatal(`پکیج ${pkgName} در node_modules یافت نشد — ابتدا bun install را اجرا کنید`)
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version
}

// ── ۱) بررسی خروجی standalone ───────────────────────────────
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  fatal('خروجی standalone یافت نشد. ابتدا «bun run build» را اجرا کنید.')
}
log('standalone یافت شد: ' + standalone)

// ── ۲) پاک‌سازی و کپی مجدد ──────────────────────────────────
fs.rmSync(appDir, { recursive: true, force: true })
fs.mkdirSync(appDir, { recursive: true })
fs.cpSync(standalone, appDir, { recursive: true })

// node_modules ردیابی‌شده توسط nft حذف می‌شود تا به‌جای آن نسخهٔ
// قطعی و پلتفرم‌درست با npm نصب شود (رفتار bun/ویندوز ناپایدار است)
const tracedNm = path.join(appDir, 'node_modules')
if (fs.existsSync(tracedNm)) {
  fs.rmSync(tracedNm, { recursive: true, force: true })
  log('node_modules ردیابی‌شده حذف شد (جایگزین با نصب قطعی npm)')
}

// اطمینان از وجود static و public داخل خروجی
if (!fs.existsSync(path.join(appDir, '.next', 'static'))) {
  const staticSrc = path.join(root, '.next', 'static')
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, path.join(appDir, '.next', 'static'), { recursive: true })
    log('.next/static کپی شد')
  } else {
    fatal('.next/static یافت نشد')
  }
}
if (!fs.existsSync(path.join(appDir, 'public'))) {
  const publicSrc = path.join(root, 'public')
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, path.join(appDir, 'public'), { recursive: true })
    log('public کپی شد')
  }
}

// ── ۳) نسخه‌های دقیق پین می‌شوند ────────────────────────────
const versions = {
  next: readVersion('next'),
  react: readVersion('react'),
  'react-dom': readVersion('react-dom'),
  '@prisma/client': readVersion('@prisma/client'),
  'client-only': readVersion('client-only'),
}
log('نسخه‌های موتور: ' + JSON.stringify(versions))

const enginePkg = {
  name: 'espad-engine',
  version: '1.1.0',
  private: true,
  description: 'موتور سرور اسپاد مبتکران پیشه (Next.js standalone) — تولید خودکار، ویرایش نکنید',
  dependencies: {
    next: versions.next,
    react: versions.react,
    'react-dom': versions['react-dom'],
    '@prisma/client': versions['@prisma/client'],
    'client-only': versions['client-only'],
  },
}
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(enginePkg, null, 2))

// ── ۴) نصب قطعی node_modules با npm ─────────────────────────
log('نصب node_modules موتور با npm (بدون اسکریپت‌های جانبی)…')
try {
  execSync('npm install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  })
} catch (e) {
  fatal('npm install داخل موتور ناموفق بود: ' + e.message)
}

// .bin فقط شیم نصب است — در زمان اجرا لازم نیست و symlink آن با NSIS مشکل‌ساز می‌شود
const binDir = path.join(appDir, 'node_modules', '.bin')
if (fs.existsSync(binDir)) {
  fs.rmSync(binDir, { recursive: true, force: true })
  log('node_modules/.bin حذف شد')
}

// ── ۵) کپی کلاینت تولیدشدهٔ Prisma + موتورها ─────────────────
const genCandidates = [
  path.join(root, 'node_modules', '.prisma', 'client'),
  path.join(root, 'node_modules', '@prisma', 'client'), // برخی چیدمان‌ها (bun) اینجا تولید می‌کنند
]
const genSrc = genCandidates.find((p) => fs.existsSync(path.join(p, 'index.js')) && fs.existsSync(path.join(p, 'schema.prisma')))
if (!genSrc) fatal('کلاینت تولیدشدهٔ Prisma (index.js + schema.prisma) یافت نشد — bunx prisma generate را اجرا کنید')

const prismaClientDir = path.join(appDir, 'node_modules', '.prisma', 'client')
fs.mkdirSync(prismaClientDir, { recursive: true })
fs.cpSync(genSrc, prismaClientDir, { recursive: true })
log('کلاینت Prisma از ' + path.relative(root, genSrc) + ' کپی شد')

// موتور ویندوز باید حتماً داخل بسته باشد (بستهٔ نهایی روی ویندوز اجرا می‌شود)
const engineFiles = fs.existsSync(prismaClientDir) ? fs.readdirSync(prismaClientDir) : []
const winEngine = engineFiles.find((f) => f.startsWith('query_engine-windows') && f.endsWith('.node'))
if (!winEngine) {
  fatal(
    'موتور کوئری ویندوز (query_engine-windows*.dll.node) در کلاینت تولیدشده یافت نشد!\n' +
      'مطمئن شوید generator client شامل binaryTargets = ["native", "windows"] است و generate روی ویندوز/با target ویندوز اجرا شده.'
  )
}
log('موتور ویندوز تأیید شد: ' + winEngine)

// ── ۶) صحت‌سنجی نهایی ساختار ────────────────────────────────
// (بدون دادهٔ دمو — دیتابیس در نصب تازه خالی است و جداول هنگام استارت موتور خودکار ساخته می‌شوند)
const mustExist = [
  path.join(appDir, 'server.js'),
  path.join(appDir, 'package.json'),
  path.join(appDir, 'node_modules', 'next', 'package.json'),
  path.join(appDir, 'node_modules', 'react', 'index.js'),
  path.join(appDir, 'node_modules', 'react-dom', 'index.js'),
  path.join(appDir, 'node_modules', '@prisma', 'client', 'package.json'),
  path.join(appDir, 'node_modules', 'client-only', 'package.json'),
  path.join(appDir, 'node_modules', '.prisma', 'client', 'index.js'),
  path.join(appDir, 'node_modules', '.prisma', 'client', 'schema.prisma'),
  path.join(appDir, 'node_modules', '.prisma', 'client', winEngine),
  path.join(appDir, '.next', 'static'),
  path.join(appDir, 'public'),
]
const missing = mustExist.filter((p) => !fs.existsSync(p))
if (missing.length) fatal('فایل‌های حیاتی مفقودند:\n' + missing.join('\n'))

fs.writeFileSync(
  path.join(appDir, 'engine-manifest.json'),
  JSON.stringify({ versions, generatedAt: new Date().toISOString(), winEngine }, null, 2)
)

log('✔ مونتاژ موتور کامل شد: desktop/resources/app')
log('مرحله بعد: electron-builder (پوشهٔ desktop) — بدون دادهٔ دمو، آمادهٔ استفادهٔ واقعی')
