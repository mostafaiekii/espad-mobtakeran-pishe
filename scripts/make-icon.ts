// ساخت آیکون ویندوز (.ico) از لوگوی کارگاه‌یار — اجرا با bun از ریشه پروژه
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'desktop', 'build')
const SVG = path.join(ROOT, 'public', 'logo.svg')

const SIZES = [16, 24, 32, 48, 64, 128]

async function renderRaw(size: number): Promise<Buffer> {
  return sharp(SVG, { density: 300 })
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer()
}

async function renderPng(size: number): Promise<Buffer> {
  return sharp(SVG, { density: 300 })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer()
}

// ساخت BMP 32بیت برای اندازه‌های کوچک (سازگاری کامل با ویندوز)
function bmpEntry(raw: Buffer, size: number): Buffer {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight (دو برابر)
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // BI_RGB
  header.writeUInt32LE(size * size * 4, 20) // biSizeImage

  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4
      const di = ((size - 1 - y) * size + x) * 4 // از پایین به بالا
      px[di] = raw[si + 2]
      px[di + 1] = raw[si + 1]
      px[di + 2] = raw[si]
      px[di + 3] = raw[si + 3]
    }
  }
  const maskRow = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskRow * size) // ماسک صفر = استفاده از آلفا
  return Buffer.concat([header, px, mask])
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const entries: { size: number; data: Buffer; png: boolean }[] = []
  for (const s of SIZES) {
    entries.push({ size: s, data: bmpEntry(await renderRaw(s), s), png: false })
  }
  entries.push({ size: 256, data: await renderPng(256), png: true })

  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // ICO
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  entries.forEach((e, i) => {
    const o = i * 16
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o) // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1) // height
    dir.writeUInt8(0, o + 2) // palette
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // planes
    dir.writeUInt16LE(32, o + 6) // bitcount
    dir.writeUInt32LE(e.data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += e.data.length
  })

  const ico = Buffer.concat([header, dir, ...entries.map((e) => e.data)])
  const out = path.join(OUT_DIR, 'icon.ico')
  fs.writeFileSync(out, ico)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), await renderPng(512))
  console.log('icon.ico written:', ico.length, 'bytes')
}

main()
