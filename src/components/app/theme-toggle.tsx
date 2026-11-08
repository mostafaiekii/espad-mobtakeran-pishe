'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Check, Contrast, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const OPTIONS = [
  { value: 'light', label: 'روشن', icon: Sun },
  { value: 'gray', label: 'خاکستری (کم‌آزار چشم)', icon: Contrast },
  { value: 'dark', label: 'تیره', icon: Moon },
] as const

const emptySubscribe = () => () => {}

/** سوییچر تم — کنار اسم «کارگاه‌یار» در همه صفحات */
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
      <Button variant="outline" size="icon" className="size-8" disabled aria-label="تم نمایش">
        <Sun className="size-4" />
      </Button>
    )
  }

  const CurrentIcon = OPTIONS.find((o) => o.value === theme)?.icon ?? Sun

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-8 shadow-sm" title="تغییر تم نمایش" aria-label="تغییر تم نمایش">
          <CurrentIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setTheme(o.value)} className="gap-2.5">
            <o.icon className="size-4" />
            <span className="flex-1">{o.label}</span>
            {theme === o.value && <Check className="size-4 text-amber-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
