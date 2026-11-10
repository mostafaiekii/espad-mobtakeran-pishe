'use client'

import { useState, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Check, Contrast, Moon, Palette, Sun, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ThemeOption {
  value: string
  label: string
  desc: string
  icon: LucideIcon
  preview: { page: string; bar: string; accent: string; block: string; line: string }
}

/** سه تم برنامه — برای مقایسه، کنار هم با پیش‌نمایش واقعی رنگ‌ها */
const OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'روشن',
    desc: 'کلاسیک روشن',
    icon: Sun,
    preview: { page: '#faf9f7', bar: '#efe9e1', accent: '#d97706', block: '#fdecc8', line: '#e8e1d8' },
  },
  {
    value: 'gray',
    label: 'خاکستری',
    desc: 'ملایم و خنثی',
    icon: Contrast,
    preview: { page: '#e7e5e4', bar: '#d6d3d1', accent: '#57534e', block: '#c8c3bd', line: '#d6d3d1' },
  },
  {
    value: 'dark',
    label: 'تیره',
    desc: 'مناسب شب‌کاری',
    icon: Moon,
    preview: { page: '#1c1917', bar: '#292524', accent: '#fbbf24', block: '#92400e', line: '#3c3530' },
  },
]

const emptySubscribe = () => () => {}

/** پیش‌نمایش کوچک یک صفحهٔ نمونه با رنگ‌های همان تم */
function MiniPreview({ p }: { p: ThemeOption['preview'] }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border/70" style={{ background: p.page }} aria-hidden>
      <div className="h-3 flex items-center gap-0.5 px-1.5" style={{ background: p.bar }}>
        <span className="size-1.5 rounded-full" style={{ background: p.accent }} />
        <span className="size-1.5 rounded-full opacity-50" style={{ background: p.accent }} />
        <span className="ml-auto h-1 w-4 rounded-full" style={{ background: p.accent, opacity: 0.8 }} />
      </div>
      <div className="p-1.5 space-y-1">
        <div className="h-4 rounded-[3px]" style={{ background: p.block }} />
        <div className="h-1.5 rounded-[3px] w-11/12" style={{ background: p.line }} />
        <div className="h-1.5 rounded-[3px] w-3/5" style={{ background: p.line }} />
      </div>
    </div>
  )
}

/**
 * انتخابگر تم — یک دکمهٔ مرتب با پنل بازشو؛ هر سه تم کنار هم با پیش‌نمایش.
 * جای قرارگیری استاندارد: کلاستر دکمه‌های اکشن در هدر همهٔ صفحات.
 */
export function ThemeToggle({ align = 'end' }: { align?: 'start' | 'center' | 'end' }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const active = mounted ? OPTIONS.find((o) => o.value === theme) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="انتخاب تم نمایش"
          title="انتخاب تم نمایش"
          className="size-9 rounded-full shrink-0 bg-card/80"
        >
          <Palette className="size-4.5 text-amber-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} dir="rtl" className="w-[310px] p-4 space-y-3" sideOffset={8}>
        {/* سرصفحهٔ پنل */}
        <div className="flex items-center gap-2.5">
          <span className="size-9 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dim:bg-stone-800 dim:text-amber-400 flex items-center justify-center shrink-0">
            <Palette className="size-4.5" />
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-extrabold">تم نمایش برنامه</div>
            <div className="text-[11px] text-muted-foreground">
              فعلی: <span className="font-bold text-foreground">{active?.label ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* سه تم کنار هم */}
        <div role="group" aria-label="انتخاب تم نمایش" className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => {
            const isActive = mounted && theme === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setTheme(o.value)}
                aria-pressed={isActive}
                title={`تم ${o.label}`}
                className={cn(
                  'rounded-xl border p-1.5 pb-2 text-center transition-all cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                  isActive
                    ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 dim:bg-stone-800'
                    : 'border-border bg-card hover:border-amber-400/50'
                )}
              >
                <MiniPreview p={o.preview} />
                <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-extrabold">
                  {isActive ? <Check className="size-3 text-amber-600" /> : <o.icon className="size-3 text-muted-foreground" />}
                  {o.label}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-muted-foreground leading-5">
          تم انتخابی روی همین دستگاه برای همیشه ذخیره می‌شود و همهٔ صفحات (نیرو و مدیریت) با آن نمایش داده می‌شوند.
        </p>
      </PopoverContent>
    </Popover>
  )
}
