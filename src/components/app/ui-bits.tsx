'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Cog, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { AdvanceStatus } from '@/lib/types'

// ─── لوگو ────────────────────────────────────────────────
export function AppLogo({ size = 'md', withText = true }: { size?: 'sm' | 'md' | 'lg'; withText?: boolean }) {
  const box = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-16 rounded-2xl' }[size]
  const icon = { sm: 'size-5', md: 'size-6', lg: 'size-9' }[size]
  const text = { sm: 'text-base', md: 'text-lg', lg: 'text-3xl' }[size]
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(box, 'bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-sm shrink-0')}>
        <Cog className={cn(icon, 'text-white animate-[spin_12s_linear_infinite]')} strokeWidth={2.2} />
      </div>
      {withText && (
        <div className="leading-tight">
          <div className={cn(text, 'font-extrabold text-foreground')}>کارگاه‌یار</div>
        </div>
      )}
    </div>
  )
}

// ─── کارت آماری ──────────────────────────────────────────
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'amber',
  className,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tone?: 'amber' | 'emerald' | 'teal' | 'stone' | 'red'
  className?: string
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    teal: 'bg-teal-100 text-teal-700',
    stone: 'bg-stone-200 text-stone-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <Card className={cn('py-0 gap-0 shadow-sm', className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('size-11 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium truncate">{label}</div>
          <div className="text-lg font-extrabold text-foreground leading-snug truncate">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── بج وضعیت مساعده ─────────────────────────────────────
export function AdvanceStatusBadge({ status }: { status: AdvanceStatus }) {
  if (status === 'PENDING')
    return (
      <Badge className="bg-amber-100 text-amber-800 border border-amber-200 gap-1.5">
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
        در انتظار بررسی
      </Badge>
    )
  if (status === 'APPROVED')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 gap-1.5">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        تایید شده
      </Badge>
    )
  return (
    <Badge className="bg-red-100 text-red-800 border border-red-200 gap-1.5">
      <span className="size-1.5 rounded-full bg-red-500" />
      رد شده
    </Badge>
  )
}

// ─── حالت خالی ───────────────────────────────────────────
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-muted-foreground">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="size-6 opacity-60" />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      {hint && <div className="text-xs max-w-xs">{hint}</div>}
    </div>
  )
}

// ─── صفحه بارگذاری ───────────────────────────────────────
export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 workshop-bg">
      <AppLogo size="lg" />
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        در حال آماده‌سازی کارگاه‌یار…
      </div>
    </div>
  )
}

// ─── دیالوگ تأیید مشترک ──────────────────────────────────
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  desc,
  confirmText = 'تأیید',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  desc?: string
  confirmText?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange} dir="rtl">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', destructive ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
              <TriangleAlert className="size-4" />
            </span>
            {title}
          </AlertDialogTitle>
          {desc && <AlertDialogDescription className="leading-6">{desc}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>انصراف</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className={destructive ? 'bg-red-600 hover:bg-red-700 font-bold' : 'font-bold'}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
