// هوک afterPack برای electron-builder
// ─────────────────────────────────────────────────────────
// electron-builder پوشهٔ node_modules را داخل extraResources فیلتر (حذف) می‌کند،
// در حالی که موتور برنامه (سرور Next.js standalone) بدون آن اجرا نمی‌شود.
// این هوک node_modules موتور را مستقیماً در خروجی بسته‌بندی (win-unpacked)
// کپی می‌کند — این مرحله قبل از کامپایل NSIS است و محتویات داخل نصب‌کننده می‌ماند.
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  const src = path.join(__dirname, 'resources', 'app', 'node_modules')
  const dest = path.join(context.appOutDir, 'resources', 'app', 'node_modules')

  if (!fs.existsSync(src)) {
    throw new Error('afterPack: منبع node_modules یافت نشد: ' + src + ' — ابتدا scripts/assemble-desktop.js را اجرا کنید')
  }
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
  }
  process.stdout.write('[afterpack] copying engine node_modules…\n')
  fs.cpSync(src, dest, { recursive: true })

  // صحت‌سنجی فایل‌های حیاتی
  const mustExist = [
    path.join(dest, 'next', 'package.json'),
    path.join(dest, 'react', 'index.js'),
    path.join(dest, 'react-dom', 'index.js'),
    path.join(dest, '@prisma', 'client', 'package.json'),
    path.join(dest, '.prisma', 'client', 'index.js'),
  ]
  const missing = mustExist.filter((p) => !fs.existsSync(p))
  if (missing.length) {
    throw new Error('afterPack: فایل‌های حیاتی موتور کپی نشدند:\n' + missing.join('\n'))
  }
  const engines = fs.existsSync(path.join(dest, '.prisma', 'client'))
    ? fs.readdirSync(path.join(dest, '.prisma', 'client')).filter((f) => f.includes('query_engine'))
    : []
  if (!engines.some((e) => e.includes('windows'))) {
    throw new Error('afterPack: موتور کوئری ویندوز در node_modules یافت نشد!')
  }
  process.stdout.write('[afterpack] engine node_modules OK — engines: ' + engines.join(', ') + '\n')
}
