// تبدیل تاریخ میلادی ⇄ جلالی (الگوریتم استاندارد jalaali-js)
export interface JDate {
  jy: number
  jm: number
  jd: number
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

function div(a: number, b: number): number {
  return ~~(a / b)
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 2061, 2672, 3300, 4614, 5668, 5732,
  6274, 7064, 7906, 8407, 8683, 8906, 9224, 9476, 9622, 9910, 10020, 10304, 10802,
  10926, 11116, 11290, 11388, 11558, 11726, 11934, 12206, 12308, 12510, 12634,
  12758, 12978, 13114, 13324, 13490, 13642, 13754, 13910, 14042, 14142, 14330,
  14500, 14630,
]

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = BREAKS.length
  const gy = jy + 621
  let leapJ = -14
  let jp = BREAKS[0]
  let jump = 0
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

export function toJalaali(date: Date): JDate {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()))
}

function d2j(jdn: number): JDate {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

export function isLeapJalaaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalaaliYear(jy) ? 30 : 29
}

/** شروع (شامل) و پایان (غیرشامل) ماه جلالی به‌صورت Date محلی */
export function jalaaliMonthRange(jy: number, jm: number): { start: Date; end: Date } {
  const s = d2g(j2d(jy, jm, 1))
  const start = new Date(s.gy, s.gm - 1, s.gd, 0, 0, 0, 0)
  const end = new Date(start.getTime() + jalaaliMonthLength(jy, jm) * 86400000)
  return { start, end }
}

export function currentJalaaliYear(): number {
  return toJalaali(new Date()).jy
}

export function currentJalaaliMonth(): number {
  return toJalaali(new Date()).jm
}

/** لیست سال‌های جلالی قابل انتخاب (سال جاری و دو سال قبل) */
export function selectableJalaaliYears(): number[] {
  const y = currentJalaaliYear()
  return [y - 2, y - 1, y]
}

export function jalaaliMonthLabel(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1]} ${jy.toLocaleString('fa-IR')}`
}
