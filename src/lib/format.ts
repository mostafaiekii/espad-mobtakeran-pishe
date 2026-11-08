// قالب‌بندی فارسی تاریخ، اعداد و مدت‌زمان

const dateFmt = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
const dateShortFmt = new Intl.DateTimeFormat('fa-IR', { year: '2-digit', month: '2-digit', day: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })

export function faNum(n: number | string): string {
  return Number(n).toLocaleString('fa-IR')
}

export function faToman(n: number | string): string {
  return `${Number(n).toLocaleString('fa-IR')} تومان`
}

export function faDate(d: string | Date): string {
  return dateFmt.format(new Date(d))
}

export function faDateShort(d: string | Date): string {
  return dateShortFmt.format(new Date(d))
}

export function faTime(d: string | Date): string {
  return timeFmt.format(new Date(d))
}

export function faDateTime(d: string | Date): string {
  return `${faDate(d)} ساعت ${faTime(d)}`
}

export function faWeekday(d: string | Date): string {
  return weekdayFmt.format(new Date(d))
}

/** ۲ ساعت و ۳۰ دقیقه */
export function faDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${faNum(m)} دقیقه`
  if (m === 0) return `${faNum(h)} ساعت`
  return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`
}

/** ساعت اعشاری: ۷.۵ ساعت */
export function faHours(h: number): string {
  return `${h.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ساعت`
}

/** تبدیل به مقدار قابل استفاده در input[type=datetime-local] بر اساس زمان محلی */
export function toLocalInput(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
