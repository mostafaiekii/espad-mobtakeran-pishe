'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JALALI_MONTHS, currentJalaaliMonth, currentJalaaliYear, jalaaliMonthLabel, jalaaliMonthRange, selectableJalaaliYears, toJalaali } from '@/lib/jalaali'

export type ScopeKey = 'all' | 'today' | 'week' | 'month' | 'month-pick' | 'day-pick' | 'custom'

export interface DateFilterState {
  scope: ScopeKey
  jYear: number
  jMonth: number
  day: string // yyyy-mm-dd
  from: string // yyyy-mm-dd (بازه دلخواه)
  to: string // yyyy-mm-dd (بازه دلخواه)
}

export function defaultFilter(): DateFilterState {
  return {
    scope: 'all',
    jYear: currentJalaaliYear(),
    jMonth: currentJalaaliMonth(),
    day: toISO(new Date()),
    from: '',
    to: '',
  }
}

export function toISO(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface DateRange {
  from: Date | null
  to: Date | null
  label: string
}

/** تبدیل فیلتر به بازه [from, to) */
export function rangeFromFilter(f: DateFilterState): DateRange {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  switch (f.scope) {
    case 'all':
      return { from: null, to: null, label: 'همه دوره‌ها' }
    case 'today': {
      const s = startOfDay(new Date())
      return { from: s, to: new Date(s.getTime() + 86400000), label: 'امروز' }
    }
    case 'week': {
      const s = startOfDay(new Date(Date.now() - 6 * 86400000))
      const e = startOfDay(new Date(Date.now() + 86400000))
      return { from: s, to: e, label: '۷ روز اخیر' }
    }
    case 'month': {
      const r = jalaaliMonthRange(currentJalaaliYear(), currentJalaaliMonth())
      return { from: r.start, to: r.end, label: jalaaliMonthLabel(currentJalaaliYear(), currentJalaaliMonth()) }
    }
    case 'month-pick': {
      const r = jalaaliMonthRange(f.jYear, f.jMonth)
      return { from: r.start, to: r.end, label: jalaaliMonthLabel(f.jYear, f.jMonth) }
    }
    case 'day-pick': {
      const d = new Date(`${f.day}T00:00:00`)
      if (isNaN(d.getTime())) return { from: null, to: null, label: 'روز نامعتبر' }
      return { from: startOfDay(d), to: new Date(startOfDay(d).getTime() + 86400000), label: `روز ${d.toLocaleDateString('fa-IR')}` }
    }
    case 'custom': {
      const a = f.from ? new Date(`${f.from}T00:00:00`) : null
      const b = f.to ? new Date(`${f.to}T00:00:00`) : null
      if (!a || isNaN(a.getTime()) || !b || isNaN(b.getTime())) return { from: null, to: null, label: 'بازه را کامل کنید' }
      return { from: startOfDay(a), to: new Date(startOfDay(b).getTime() + 86400000), label: `از ${a.toLocaleDateString('fa-IR')} تا ${b.toLocaleDateString('fa-IR')}` }
    }
  }
}

export function inRange(ts: number, r: DateRange): boolean {
  if (!r.from || !r.to) return true
  return ts >= r.from.getTime() && ts < r.to.getTime()
}

const SCOPES: { key: ScopeKey; label: string }[] = [
  { key: 'all', label: 'همه دوره‌ها' },
  { key: 'today', label: 'امروز' },
  { key: 'week', label: '۷ روز اخیر' },
  { key: 'month', label: 'این ماه' },
  { key: 'month-pick', label: 'انتخاب ماه' },
  { key: 'day-pick', label: 'انتخاب روز' },
  { key: 'custom', label: 'بازه دلخواه' },
]

/** فیلتر بازه زمانی: امروز / هفته / ماه شمسی / روز مشخص / بازه دلخواه */
export function DateFilter({
  value,
  onChange,
  compact = false,
}: {
  value: DateFilterState
  onChange: (v: DateFilterState) => void
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={value.scope} onValueChange={(s) => onChange({ ...value, scope: s as ScopeKey })} dir="rtl">
        <SelectTrigger className={compact ? 'w-36' : 'w-40'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCOPES.map((s) => (
            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.scope === 'month-pick' && (
        <>
          <Select value={String(value.jMonth)} onValueChange={(m) => onChange({ ...value, jMonth: Number(m) })} dir="rtl">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JALALI_MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(value.jYear)} onValueChange={(y) => onChange({ ...value, jYear: Number(y) })} dir="rtl">
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableJalaaliYears().map((y) => (
                <SelectItem key={y} value={String(y)}>{y.toLocaleString('fa-IR')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {value.scope === 'day-pick' && (
        <Input type="date" className="w-40" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} />
      )}

      {value.scope === 'custom' && (
        <>
          <Input type="date" className="w-36" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="از تاریخ" />
          <span className="text-xs text-muted-foreground">تا</span>
          <Input type="date" className="w-36" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="تا تاریخ" />
        </>
      )}
    </div>
  )
}

/** چک این‌که روز انتخاب‌شده در ماه جاری جلالی است (برای پیش‌فرض گزارش‌ها) */
export function isCurrentJalaaliMonth(d: Date): boolean {
  const j = toJalaali(d)
  return j.jy === currentJalaaliYear() && j.jm === currentJalaaliMonth()
}
