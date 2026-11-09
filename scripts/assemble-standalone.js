// کپی فایل‌های استاتیک و public به داخل خروجی standalone — کراس‌پلتفرم (ویندوز/لینوکس/مک)
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')

function copyTo(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[assemble] skip (missing):', src)
    return
  }
  fs.cpSync(src, dest, { recursive: true, force: true })
  console.log('[assemble] copied:', path.relative(root, src), '->', path.relative(root, dest))
}

copyTo(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'))
copyTo(path.join(root, 'public'), path.join(standalone, 'public'))
console.log('[assemble] done')
