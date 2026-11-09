'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Contrast, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'روشن', short: 'روشن', icon: Sun, active: 'bg-white text-amber-700 shadow-sm' },
  { value: 'gray', label: 'خاکستری', short: 'خاکستری', icon: Contrast, active: 'bg-stone-600 text-white shadow-sm' },
  { value: 'dark', label: 'تیره', short: 'تیره', icon: Moon, active: 'bg-stone-900 text-amber-400 shadow-sm' },
] as const

const emptySubscribe = () => () => {}

/**
 * سوییچر تم — سه تم روشن / خاکستری / تیره کنار هم
 * در همهٔ صفحات کنار اسم «اسپاد مبتکران پیشه» نمایش داده می‌شود.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // تشخیص mount بدون setState در effect (سازگار با SSR)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <div className="flex items-center rounded-full border border-border bg-muted/60 p-0.5 gap-0.5" aria-hidden>
        {OPTIONS.map((o) => (
          <span key={o.value} className="size-7 sm:size-8 rounded-full flex items-center justify-center">
            <o.icon className="size-3.5 sm:size-4 text-muted-foreground" />
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label="انتخاب تم نمایش"
      className="flex items-center rounded-full border border-border bg-muted/60 p-0.5 gap-0.5 shadow-sm"
    >
      {OPTIONS.map((o) => {
        const active = theme === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-pressed={active}
            title={`تم ${o.label}`}
            className={cn(
              'h-7 sm:h-8 rounded-full flex items-center justify-center gap-1 px-1.5 sm:px-2.5 transition-all cursor-pointer',
              'min-w-7 sm:min-w-8',
              active
                ? o.active
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            )}
          >
            <o.icon className="size-3.5 sm:size-4" />
            <span className={cn('text-[10px] sm:text-[11px] font-bold', active ? 'inline' : 'hidden md:inline')}>
              {o.short}
            </span>
          </button>
        )
      })}
    </div>
  )
}
