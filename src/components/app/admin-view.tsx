'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppLogo, ConfirmDialog, EmptyState, StatCard, AdvanceStatusBadge } from '@/components/app/ui-bits'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { DateFilter, type DateFilterState, defaultFilter, rangeFromFilter, inRange } from '@/components/app/date-filter'
import { apiGet, apiPost, apiPatch, apiDelete, clearSession } from '@/lib/api'
import { faNum, faToman, faTime, faDate, faDateShort, faDateTime, faDuration, faHours } from '@/lib/format'
import { TASK_CATEGORIES, type SessionUser, type AdminData, type AdvanceRec, type WorkerSummary } from '@/lib/types'
import { buildReportSections, exportXlsx, exportCsv, printReport, type ReportType, type ReportSection } from '@/lib/report-export'
import { toJalaali } from '@/lib/jalaali'
import {
  Users,
  UserCheck,
  Factory,
  Banknote,
  LayoutDashboard,
  Clock,
  Cog,
  Wallet,
  ClipboardList,
  RefreshCw,
  LogOut,
  LogIn,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
  History,
  Ban,
  Pencil,
  Trash2,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Printer,
  Table2,
  Wifi,
  Copy,
  Router,
  MonitorSmartphone,
  Check,
} from 'lucide-react'

interface Props {
  user: SessionUser
  onLogout: () => void
}

type Section = 'dashboard' | 'workers' | 'attendance' | 'cnc' | 'advances' | 'tasks' | 'reports' | 'network'

const NAV: { key: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'workers', label: 'نیروها', icon: Users },
  { key: 'attendance', label: 'حضور و غیاب', icon: Clock },
  { key: 'cnc', label: 'ماشین‌کاری CNC', icon: Cog },
  { key: 'advances', label: 'درخواست مساعده', icon: Wallet },
  { key: 'tasks', label: 'گزارش کارها', icon: ClipboardList },
  { key: 'reports', label: 'گزارش‌گیری', icon: FileBarChart },
  { key: 'network', label: 'راهنمای اتصال', icon: Wifi },
]

const CHART = {
  amber: '#d97706',
  teal: '#0d9488',
  emerald: '#059669',
  red: '#dc2626',
  stone: '#a8a29e',
}

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: 'attendance', label: 'حضور و غیاب (ورود/خروج)' },
  { key: 'cnc', label: 'ماشین‌کاری CNC' },
  { key: 'advance', label: 'درخواست مساعده' },
  { key: 'tasks', label: 'گزارش کارها' },
  { key: 'all', label: 'همه موارد (چند شیت)' },
]

interface FeedItem {
  key: string
  icon: typeof Clock
  color: string
  text: string
  sub: string
  time: number
}

type WorkerDialog = { mode: 'add' } | { mode: 'edit'; worker: WorkerSummary } | null

export function AdminView({ user, onLogout }: Props) {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('dashboard')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'gray'

  // فیلترها
  const [attFilter, setAttFilter] = useState('ALL')
  const [attDate, setAttDate] = useState<DateFilterState>(defaultFilter())
  const [cncFilter, setCncFilter] = useState('ALL')
  const [taskFilter, setTaskFilter] = useState('ALL')
  const [feedDate, setFeedDate] = useState<DateFilterState>(defaultFilter())

  // گفت‌وگوی بررسی مساعده
  const [review, setReview] = useState<{ adv: AdvanceRec; action: 'APPROVED' | 'REJECTED' } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  // گفت‌وگوی افزودن/ویرایش نیرو
  const [workerDialog, setWorkerDialog] = useState<WorkerDialog>(null)
  const [wName, setWName] = useState('')
  const [wPhone, setWPhone] = useState('')
  const [wJob, setWJob] = useState('')
  const [wRate, setWRate] = useState('')
  const [wPass, setWPass] = useState('')
  const [savingWorker, setSavingWorker] = useState(false)
  const [deleteW, setDeleteW] = useState<WorkerSummary | null>(null)
  const [busyWorkerDel, setBusyWorkerDel] = useState(false)

  // گزارش‌گیری
  const [repType, setRepType] = useState<ReportType>('attendance')
  const [repDate, setRepDate] = useState<DateFilterState>({ ...defaultFilter(), scope: 'month' })
  const [repWorker, setRepWorker] = useState('ALL')

  // راهنمای اتصال (شبکه محلی)
  const [netInfo, setNetInfo] = useState<{ ips: string[]; port: number; urls: string[] } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    try {
      const d = await apiGet<AdminData>('/api/admin/data')
      setData(d)
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'خطا در دریافت داده‌ها')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // بروزرسانی خودکار هر ۸ ثانیه — ثبت‌های نیروها فوراً در پنل مدیریت دیده می‌شود
    const iv = setInterval(() => refresh(true), 8000)
    return () => clearInterval(iv)
  }, [refresh])

  // گرفتن آدرس‌های شبکه برای بخش راهنمای اتصال
  useEffect(() => {
    if (section !== 'network') return
    setNetInfo(null)
    apiGet<{ ips: string[]; port: number; urls: string[] }>('/api/network')
      .then(setNetInfo)
      .catch(() => setNetInfo({ ips: [], port: 0, urls: [] }))
  }, [section])

  function copyUrl(u: string) {
    navigator.clipboard
      .writeText(u)
      .then(() => {
        setCopiedUrl(u)
        toast.success('آدرس کپی شد — برای نیروها بفرستید')
        setTimeout(() => setCopiedUrl(null), 2000)
      })
      .catch(() => toast.error('کپی نشد؛ آدرس را دستی انتخاب و کپی کنید'))
  }

  const stats = data?.stats

  // ── فید فعالیت‌های اخیر (با فیلتر تاریخ) ──
  const feedRange = useMemo(() => rangeFromFilter(feedDate), [feedDate])
  const feed: FeedItem[] = useMemo(() => {
    if (!data) return []
    const items: FeedItem[] = []
    for (const a of data.attendances) {
      const entry = a.type === 'ENTRY'
      items.push({
        key: `a-${a.id}`,
        icon: entry ? LogIn : LogOut,
        color: entry ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600',
        text: `${a.userName} — ${entry ? 'ورود به کارگاه' : 'خروج از کارگاه'}`,
        sub: entry ? 'حضور ثبت شد' : 'پایان شیفت',
        time: new Date(a.timestamp).getTime(),
      })
    }
    for (const c of data.cncJobs) {
      items.push({
        key: `c-${c.id}`,
        icon: Factory,
        color: 'bg-amber-100 text-amber-700',
        text: `${c.userName} — تایم CNC روی ${c.machine}`,
        sub: `${c.partName} · ${faDuration(c.durationMin)}`,
        time: new Date(c.startTime).getTime(),
      })
    }
    for (const a of data.advances) {
      const isPending = a.status === 'PENDING'
      items.push({
        key: `v-${a.id}`,
        icon: isPending ? Banknote : a.status === 'APPROVED' ? CheckCircle2 : Ban,
        color: isPending ? 'bg-amber-100 text-amber-700' : a.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
        text: isPending ? `${a.userName} — درخواست مساعده جدید` : `${a.userName} — مساعده ${a.status === 'APPROVED' ? 'تایید شد' : 'رد شد'}`,
        sub: faToman(a.amount),
        time: new Date((!isPending ? a.reviewedAt ?? a.createdAt : a.createdAt)).getTime(),
      })
    }
    for (const t of data.tasks) {
      items.push({
        key: `t-${t.id}`,
        icon: ClipboardList,
        color: 'bg-teal-100 text-teal-700',
        text: `${t.userName} — ثبت کار: ${t.title}`,
        sub: TASK_CATEGORIES.find((c) => c.key === t.category)?.label ?? '',
        time: new Date(t.createdAt).getTime(),
      })
    }
    return items
      .filter((i) => inRange(i.time, feedRange))
      .sort((a, b) => b.time - a.time)
      .slice(0, 20)
  }, [data, feedRange])

  const pendingAdvances = useMemo(() => data?.advances.filter((a) => a.status === 'PENDING') ?? [], [data])
  const totalCncMin = useMemo(() => (data ? data.cncJobs.reduce((s, c) => s + c.durationMin, 0) : 0), [data])

  const attRange = useMemo(() => rangeFromFilter(attDate), [attDate])
  const filteredAtt = useMemo(
    () =>
      data
        ? data.attendances.filter(
            (a) => (attFilter === 'ALL' || a.userId === attFilter) && inRange(new Date(a.timestamp).getTime(), attRange)
          )
        : [],
    [data, attFilter, attRange]
  )
  const filteredCnc = useMemo(() => (data ? data.cncJobs.filter((c) => cncFilter === 'ALL' || c.userId === cncFilter) : []), [data, cncFilter])
  const filteredTasks = useMemo(() => (data ? data.tasks.filter((t) => taskFilter === 'ALL' || t.userId === taskFilter) : []), [data, taskFilter])

  // ── گزارش‌گیری ──
  const repRange = useMemo(() => rangeFromFilter(repDate), [repDate])
  const repSections: ReportSection[] = useMemo(
    () => (data ? buildReportSections(data, repType, repRange, repWorker) : []),
    [data, repType, repRange, repWorker]
  )
  const repTotalRows = repSections.reduce((s, x) => s + x.rows.length, 0)

  const weekChart = useMemo(
    () => (stats ? stats.weekAttendance.map((d) => ({ name: weekdayShort(d.date), count: d.count })) : []),
    [stats]
  )
  const machineChart = useMemo(
    () => (stats ? stats.cncByMachine.map((m) => ({ name: m.machine, hours: Math.round((m.minutes / 60) * 10) / 10 })) : []),
    [stats]
  )
  const pieData = useMemo(() => stats?.advanceStatusDist.filter((s) => s.value > 0) ?? [], [stats])

  // ── اکشن‌ها ──
  async function submitReview() {
    if (!review) return
    setReviewing(true)
    try {
      await apiPatch('/api/admin/advance', { id: review.adv.id, status: review.action, reviewNote })
      toast.success(review.action === 'APPROVED' ? 'درخواست تایید شد ✅' : 'درخواست رد شد')
      setReview(null)
      setReviewNote('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بررسی')
    } finally {
      setReviewing(false)
    }
  }

  function openAddWorker() {
    setWName(''); setWPhone(''); setWJob(''); setWRate(''); setWPass('')
    setWorkerDialog({ mode: 'add' })
  }

  function openEditWorker(w: WorkerSummary) {
    setWName(w.name)
    setWPhone(w.phone)
    setWJob(w.jobTitle || '')
    setWRate(String(w.hourlyRate || ''))
    setWPass('')
    setWorkerDialog({ mode: 'edit', worker: w })
  }

  async function submitWorker(e: React.FormEvent) {
    e.preventDefault()
    if (!workerDialog) return
    setSavingWorker(true)
    try {
      if (workerDialog.mode === 'add') {
        await apiPost('/api/admin/users', { name: wName, phone: wPhone, jobTitle: wJob, hourlyRate: Number(wRate) || 0, password: wPass })
        toast.success('نیروی جدید اضافه شد 🎉')
      } else {
        await apiPatch('/api/admin/users', {
          id: workerDialog.worker.id,
          name: wName,
          phone: wPhone,
          jobTitle: wJob,
          hourlyRate: Number(wRate) || 0,
          password: wPass || undefined,
        })
        toast.success('اطلاعات نیرو ویرایش شد ✏️')
      }
      setWorkerDialog(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره نیرو')
    } finally {
      setSavingWorker(false)
    }
  }

  async function doDeleteWorker() {
    if (!deleteW) return
    setBusyWorkerDel(true)
    try {
      await apiDelete(`/api/admin/users?id=${deleteW.id}`)
      toast.success(`نیروی «${deleteW.name}» و همه رکوردهایش حذف شد 🗑️`)
      setDeleteW(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف نیرو')
    } finally {
      setBusyWorkerDel(false)
    }
  }

  function doExportXlsx() {
    if (repTotalRows === 0) {
      toast.error('رکوردی برای خروجی وجود ندارد')
      return
    }
    exportXlsx(repSections, `spad-report-${jalaaliToday()}.xlsx`)
      .then(() => toast.success('فایل اکسل دانلود شد 📊'))
      .catch(() => toast.error('خطا در ساخت فایل اکسل'))
  }

  function doExportCsv() {
    if (repType === 'all') {
      toast.error('برای «همه موارد» از خروجی اکسل یا PDF استفاده کنید (هر نوع، شیت جدا)')
      return
    }
    const sec = repSections[0]
    if (!sec || sec.rows.length === 0) {
      toast.error('رکوردی برای خروجی وجود ندارد')
      return
    }
    exportCsv(sec, `spad-${sec.key}-${jalaaliToday()}.csv`)
    toast.success('فایل CSV دانلود شد 📄')
  }

  function doPrint() {
    if (repTotalRows === 0) {
      toast.error('رکوردی برای چاپ وجود ندارد')
      return
    }
    printReport(repSections, {
      rangeLabel: repRange.label,
      workerLabel: repWorker === 'ALL' ? 'همه نیروها' : data?.workers.find((w) => w.id === repWorker)?.name || '—',
      generatedAt: faDateTimeLabel(),
    })
    toast.info('پنجره چاپ باز شد — «Save as PDF» را انتخاب کنید 🖨️')
  }

  function logout() {
    clearSession()
    onLogout()
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* ── سایدبار دسکتاپ ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10 flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0">
            <Cog className="size-6 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm leading-snug">اسپاد مبتکران پیشه</div>
            <div className="text-[11px] text-white/60">پنل مدیریت کارگاه</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV.map((n) => {
            const active = section === n.key
            return (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-amber-600 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <n.icon className="size-4.5" />
                <span className="flex-1 text-right">{n.label}</span>
                {n.key === 'advances' && pendingAdvances.length > 0 && (
                  <span className="size-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {faNum(pendingAdvances.length)}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10 flex items-center gap-3">
          <div className="size-9 rounded-full bg-amber-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{user.name}</div>
            <div className="text-[11px] text-white/60">مدیر کارگاه</div>
          </div>
          <ThemeToggle align="start" />
          <Button variant="ghost" size="icon" onClick={logout} title="خروج" className="text-white/60 hover:text-white hover:bg-white/10">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── هدر موبایل + ناوبری ── */}
        <header className="lg:hidden sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppLogo size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle align="start" />
              <Badge className="bg-amber-600">مدیر</Badge>
              <span className="text-sm font-bold">{user.name}</span>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="size-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 custom-scrollbar">
            {NAV.map((n) => {
              const active = section === n.key
              return (
                <button
                  key={n.key}
                  onClick={() => setSection(n.key)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent/60'
                  }`}
                >
                  <n.icon className="size-3.5" />
                  {n.label}
                  {n.key === 'advances' && pendingAdvances.length > 0 && (
                    <span className="size-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {faNum(pendingAdvances.length)}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </header>

        <main className="flex-1 w-full max-w-6xl lg:max-w-none px-4 lg:px-8 py-6 space-y-6">
          {/* ═════════ داشبورد ═════════ */}
          {section === 'dashboard' && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black flex items-center gap-2">
                    بانک اطلاعات کارگاه
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2.5 py-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      زنده — بروزرسانی خودکار
                    </span>
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">{faDate(new Date())} — هر ثبت جدید ظرف چند ثانیه در همین صفحه دیده می‌شود</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
                  <RefreshCw className="size-4" /> به‌روزرسانی
                </Button>
              </div>

              <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard icon={Users} label="نیروهای فعال" value={faNum(stats!.totalWorkers)} tone="stone" />
                <StatCard
                  icon={UserCheck}
                  label="حاضران امروز"
                  value={`${faNum(stats!.presentToday)} نفر`}
                  sub={`از ${faNum(stats!.totalWorkers)} نیرو`}
                  tone="emerald"
                />
                <StatCard
                  icon={Factory}
                  label="ماشین‌کاری امروز"
                  value={faHours(Math.round(stats!.todayCncMin / 60))}
                  sub={`${faNum(stats!.todayCncJobs)} تایم ثبت‌شده`}
                  tone="amber"
                />
                <StatCard
                  icon={Banknote}
                  label="مساعده در انتظار"
                  value={`${faNum(stats!.pendingAdvances)} درخواست`}
                  sub={faToman(stats!.pendingAmount)}
                  tone="red"
                />
              </section>

              <section className="grid lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="size-4 text-amber-600" /> حضور نیروها در ۷ روز اخیر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.1)' : '#e7e5e4'} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#a8a29e' : '#78716c' }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: isDark ? '#a8a29e' : '#78716c' }} axisLine={false} tickLine={false} tickFormatter={(v) => faNum(v)} />
                          <Tooltip cursor={{ fill: 'rgba(217,119,6,0.08)' }} formatter={(v) => [`${faNum(v as number)} نفر`, 'ورود']} contentStyle={{ borderRadius: 12, border: '1px solid #fde68a', backgroundColor: isDark ? '#1c1917' : '#fff', color: isDark ? '#fafaf9' : '#292524' }} />
                          <Bar dataKey="count" fill={CHART.amber} radius={[6, 6, 0, 0]} maxBarSize={42} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="size-4 text-amber-600" /> وضعیت درخواست‌های مساعده
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length === 0 ? (
                      <EmptyState icon={Banknote} title="داده‌ای برای نمایش نیست" />
                    ) : (
                      <div className="h-64" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                              {pieData.map((s) => (
                                <Cell
                                  key={s.key}
                                  fill={s.key === 'PENDING' ? CHART.amber : s.key === 'APPROVED' ? CHART.emerald : CHART.red}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${faNum(v as number)} مورد`} contentStyle={{ borderRadius: 12, backgroundColor: isDark ? '#1c1917' : '#fff', color: isDark ? '#fafaf9' : '#292524' }} />
                            <Legend iconType="circle" formatter={(v) => <span style={{ fontSize: 12, color: isDark ? '#d6d3d1' : '#57534e' }}>{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cog className="size-4 text-amber-600" /> ساعت CNC به تفکیک دستگاه
                    </CardTitle>
                    <CardDescription>مجموع {faHours(Math.round(totalCncMin / 60))} در کل دوره</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {machineChart.length === 0 ? (
                      <EmptyState icon={Factory} title="هنوز تایمی ثبت نشده" />
                    ) : (
                      <div className="h-56" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={machineChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(255,255,255,0.1)' : '#e7e5e4'} />
                            <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? '#a8a29e' : '#78716c' }} axisLine={false} tickLine={false} tickFormatter={(v) => faNum(v)} />
                            <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11, fill: isDark ? '#d6d3d1' : '#57534e' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [`${faNum(v as number)} ساعت`, 'کارکرد']} contentStyle={{ borderRadius: 12, backgroundColor: isDark ? '#1c1917' : '#fff', color: isDark ? '#fafaf9' : '#292524' }} />
                            <Bar dataKey="hours" fill={CHART.teal} radius={[0, 6, 6, 0]} maxBarSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Inbox className="size-4 text-amber-600" /> فعالیت‌های اخیر کارگاه
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {feedRange.label} · {faNum(feed.length)} رویداد
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DateFilter value={feedDate} onChange={setFeedDate} compact />
                    <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 pl-1">
                      {feed.length === 0 ? (
                        <EmptyState icon={Inbox} title="رویدادی در این بازه نیست" hint="بازه زمانی را تغییر دهید" />
                      ) : (
                        feed.map((f) => (
                          <div key={f.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60">
                            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${f.color}`}>
                              <f.icon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{f.text}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{f.sub}</div>
                            </div>
                            <div className="text-[11px] text-muted-foreground shrink-0">{faTime(f.time)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}

          {/* ═════════ نیروها ═════════ */}
          {section === 'workers' && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black">نیروهای کارگاه</h1>
                  <p className="text-sm text-muted-foreground mt-1">{faNum(data.workers.length)} نیروی ثبت‌شده در سامانه — ویرایش و حذف از ستون عملیات</p>
                </div>
                <Button onClick={openAddWorker} className="gap-1.5 font-bold">
                  <UserPlus className="size-4" /> افزودن نیرو
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar rounded-xl border">
                    <table className="w-full text-sm min-w-[780px]">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                        <tr className="text-muted-foreground">
                          <th className="py-3 px-4 text-right font-medium">نیرو</th>
                          <th className="py-3 px-4 text-center font-medium">موبایل</th>
                          <th className="py-3 px-4 text-center font-medium">وضعیت امروز</th>
                          <th className="py-3 px-4 text-center font-medium">CNC این هفته</th>
                          <th className="py-3 px-4 text-center font-medium">مساعده در انتظار</th>
                          <th className="py-3 px-4 text-center font-medium">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.workers.map((w) => (
                          <tr key={w.id} className="border-t even:bg-muted/40">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="size-9 rounded-full bg-amber-100 text-amber-800 font-bold text-sm flex items-center justify-center shrink-0">
                                  {w.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold">{w.name}</div>
                                  <div className="text-[11px] text-muted-foreground">{w.jobTitle || 'نیروی کارگاه'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs" dir="ltr">{w.phone}</td>
                            <td className="py-3 px-4 text-center">
                              {w.presentToday ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">حاضر از {faTime(w.todayEntry!)}</Badge>
                              ) : w.todayExit ? (
                                <Badge variant="secondary" className="bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">خروج ثبت‌شده</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border border-red-200">غایب</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">{faHours(w.weekHours)}</td>
                            <td className="py-3 px-4 text-center">
                              {w.pendingAdvances > 0 ? (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{faNum(w.pendingAdvances)} درخواست</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="size-8" title="ویرایش نیرو" onClick={() => openEditWorker(w)}>
                                  <Pencil className="size-4 text-teal-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-8" title="حذف نیرو" onClick={() => setDeleteW(w)}>
                                  <Trash2 className="size-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ═════════ حضور و غیاب ═════════ */}
          {section === 'attendance' && (
            <>
              <div>
                <h1 className="text-xl lg:text-2xl font-black">حضور و غیاب</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {attRange.label} · <b className="text-foreground">{faNum(filteredAtt.length)}</b> رکورد
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DateFilter value={attDate} onChange={setAttDate} />
                <WorkerFilter value={attFilter} onChange={setAttFilter} workers={data.workers} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <RecordsTable
                    emptyIcon={Clock}
                    emptyTitle="رکوردی در این بازه یافت نشد"
                    emptyHint="بازه زمانی یا نیروی فیلتر را تغییر دهید"
                    rows={filteredAtt.slice(0, 300).map((a) => ({
                      id: a.id,
                      cells: [
                        <span key="u" className="font-bold">{a.userName}</span>,
                        a.type === 'ENTRY' ? (
                          <Badge key="t" className="bg-emerald-100 text-emerald-800 border border-emerald-200 gap-1"><LogIn className="size-3" /> ورود</Badge>
                        ) : (
                          <Badge key="t" variant="secondary" className="bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 gap-1"><LogOut className="size-3" /> خروج</Badge>
                        ),
                        <span key="d" className="text-xs">{faDateShort(a.timestamp)}</span>,
                        <span key="h" className="font-mono text-xs" dir="ltr">{faTime(a.timestamp)}</span>,
                        <span key="n" className="text-xs text-muted-foreground">{a.note || '—'}</span>,
                      ],
                    }))}
                    headers={['نیرو', 'نوع', 'تاریخ', 'ساعت', 'یادداشت']}
                    aligns={['right', 'center', 'center', 'center', 'center']}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* ═════════ CNC ═════════ */}
          {section === 'cnc' && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black">ماشین‌کاری CNC</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    مجموع کارکرد: <b className="text-foreground">{faHours(Math.round(totalCncMin / 60))}</b>
                  </p>
                </div>
                <WorkerFilter value={cncFilter} onChange={setCncFilter} workers={data.workers} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <RecordsTable
                    emptyIcon={Factory}
                    emptyTitle="تایمی ثبت نشده"
                    rows={filteredCnc.slice(0, 300).map((c) => ({
                      id: c.id,
                      cells: [
                        <span key="u" className="font-bold">{c.userName}</span>,
                        <span key="m" className="text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 rounded-md px-2 py-0.5">{c.machine}</span>,
                        <span key="p">{c.partName}</span>,
                        <span key="mt" className="text-xs text-muted-foreground">{c.material || '—'}</span>,
                        <span key="d" className="text-xs">{faDateShort(c.startTime)} · <span dir="ltr" className="font-mono">{faTime(c.startTime)}</span></span>,
                        <span key="du" className="font-bold text-amber-600 dark:text-amber-400">{faDuration(c.durationMin)}</span>,
                        c.status === 'RUNNING' ? (
                          <Badge key="s" className="bg-amber-100 text-amber-800 border border-amber-200 gap-1"><span className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> در جریان</Badge>
                        ) : (
                          <Badge key="s" variant="secondary" className="bg-emerald-100 text-emerald-800">تمام‌شده</Badge>
                        ),
                      ],
                    }))}
                    headers={['نیرو', 'دستگاه', 'قطعه', 'جنس', 'زمان شروع', 'مدت', 'وضعیت']}
                    aligns={['right', 'center', 'right', 'center', 'center', 'center', 'center']}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* ═════════ مساعده ═════════ */}
          {section === 'advances' && (
            <>
              <div>
                <h1 className="text-xl lg:text-2xl font-black">درخواست‌های مساعده</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingAdvances.length > 0
                    ? `${faNum(pendingAdvances.length)} درخواست در انتظار بررسی · مجموع ${faToman(stats!.pendingAmount)}`
                    : 'درخواست در انتظاری وجود ندارد'}
                </p>
              </div>

              {pendingAdvances.length > 0 && (
                <section className="grid md:grid-cols-2 gap-3">
                  {pendingAdvances.map((a) => (
                    <Card key={a.id} className="border-amber-200 shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="size-9 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center">{a.userName.charAt(0)}</div>
                            <div>
                              <div className="font-bold text-sm">{a.userName}</div>
                              <div className="text-[11px] text-muted-foreground">{faDateTime(a.createdAt)}</div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-black text-amber-600 dark:text-amber-400">{faToman(a.amount)}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2.5 leading-6">{a.reason}</p>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { setReview({ adv: a, action: 'APPROVED' }); setReviewNote('') }}
                          >
                            <CheckCircle2 className="size-4" /> تایید
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 gap-1.5 font-bold border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => { setReview({ adv: a, action: 'REJECTED' }); setReviewNote('') }}
                          >
                            <XCircle className="size-4" /> رد
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">تاریخچه درخواست‌ها</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <RecordsTable
                    emptyIcon={Banknote}
                    emptyTitle="درخواستی ثبت نشده"
                    rows={data.advances.map((a) => ({
                      id: a.id,
                      cells: [
                        <span key="u" className="font-bold">{a.userName}</span>,
                        <span key="a" className="font-bold text-amber-600 dark:text-amber-400">{faToman(a.amount)}</span>,
                        <span key="r" className="text-xs text-muted-foreground max-w-52 inline-block truncate">{a.reason}</span>,
                        <AdvanceStatusBadge key="s" status={a.status} />,
                        <span key="d" className="text-xs text-muted-foreground">{faDateShort(a.createdAt)}</span>,
                      ],
                    }))}
                    headers={['نیرو', 'مبلغ', 'دلیل', 'وضعیت', 'تاریخ ثبت']}
                    aligns={['right', 'center', 'right', 'center', 'center']}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* ═════════ کارها ═════════ */}
          {section === 'tasks' && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-xl lg:text-2xl font-black">گزارش کارهای نیروها</h1>
                <WorkerFilter value={taskFilter} onChange={setTaskFilter} workers={data.workers} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <RecordsTable
                    emptyIcon={ClipboardList}
                    emptyTitle="کاری ثبت نشده"
                    rows={filteredTasks.slice(0, 300).map((t) => ({
                      id: t.id,
                      cells: [
                        <span key="u" className="font-bold">{t.userName}</span>,
                        <span key="t">{t.title}</span>,
                        <Badge key="c" variant="outline" className="bg-transparent">{TASK_CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category}</Badge>,
                        <span key="d" className="text-xs text-muted-foreground">{faDate(t.date)}</span>,
                        t.status === 'DONE' ? (
                          <Badge key="s" className="bg-emerald-100 text-emerald-800 border border-emerald-200">انجام‌شده</Badge>
                        ) : (
                          <Badge key="s" className="bg-amber-100 text-amber-800 border border-amber-200">در جریان</Badge>
                        ),
                      ],
                    }))}
                    headers={['نیرو', 'کار', 'دسته', 'تاریخ', 'وضعیت']}
                    aligns={['right', 'right', 'center', 'center', 'center']}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* ═════════ گزارش‌گیری ═════════ */}
          {section === 'reports' && (
            <>
              <div>
                <h1 className="text-xl lg:text-2xl font-black">گزارش‌گیری و خروجی</h1>
                <p className="text-sm text-muted-foreground mt-1">داده‌ها را انتخاب و در فرمت اکسل، CSV یا PDF خروجی بگیرید</p>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Table2 className="size-4 text-amber-600" /> تنظیمات گزارش
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={repType} onValueChange={(v) => setRepType(v as ReportType)} dir="rtl">
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DateFilter value={repDate} onChange={setRepDate} />
                    <WorkerFilter value={repWorker} onChange={setRepWorker} workers={data.workers} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {repSections.map((s) => (
                      <Badge key={s.key} variant="secondary" className="bg-muted">
                        {s.title}: <b className="mx-1">{faNum(s.rows.length)}</b> رکورد
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button onClick={doExportXlsx} className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700" disabled={repTotalRows === 0}>
                      <FileSpreadsheet className="size-4" /> خروجی اکسل (xlsx)
                    </Button>
                    <Button onClick={doExportCsv} variant="outline" className="gap-1.5 font-bold" disabled={repType === 'all' || repTotalRows === 0}>
                      <FileText className="size-4" /> خروجی CSV
                    </Button>
                    <Button onClick={doPrint} variant="outline" className="gap-1.5 font-bold" disabled={repTotalRows === 0}>
                      <Printer className="size-4" /> چاپ / ذخیره PDF
                    </Button>
                    {repType === 'all' && (
                      <span className="text-xs text-muted-foreground">در حالت «همه موارد»، اکسل هر نوع را در یک شیت جدا خروجی می‌دهد</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {repSections.map((s) => (
                <Card key={s.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Table2 className="size-4 text-amber-600" /> پیش‌نمایش: {s.title}
                      <span className="text-xs font-normal text-muted-foreground">({faNum(s.rows.length)} رکورد · {repRange.label})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {s.rows.length === 0 ? (
                      <div className="p-2">
                        <EmptyState icon={Inbox} title="رکوردی در این بازه نیست" hint="بازه زمانی، نیرو یا نوع گزارش را تغییر دهید" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-72 overflow-y-auto custom-scrollbar rounded-xl border mx-4 mb-4">
                        <table className="w-full text-xs min-w-[560px]">
                          <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                            <tr className="text-muted-foreground">
                              {s.headers.map((h, i) => (
                                <th key={i} className="py-2.5 px-3 font-medium text-right whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.rows.slice(0, 20).map((r, ri) => (
                              <tr key={ri} className="border-t even:bg-muted/40">
                                {r.map((c, ci) => (
                                  <td key={ci} className="py-2 px-3 whitespace-nowrap">{String(c) || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* ═════════ راهنمای اتصال (شبکه محلی) ═════════ */}
          {section === 'network' && (
            <>
              <div>
                <h1 className="text-xl lg:text-2xl font-black">راهنمای اتصال سیستم‌های کارگاه</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  نیروها بدون نصب هیچ برنامه‌ای، با مرورگر سیستم خودشان به همین برنامه وصل می‌شوند
                </p>
              </div>

              {/* آدرس اتصال */}
              <Card className="border-amber-200 bg-amber-50/60 dim:bg-amber-950/20 dark:bg-amber-950/20 dim:border-amber-900 dark:border-amber-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi className="size-4.5 text-amber-600" /> آدرس اتصال نیروها
                  </CardTitle>
                  <CardDescription>
                    یکی از این آدرس‌ها را روی سیستم‌های نیروها در مرورگر (Chrome / Edge) باز کنید
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {netInfo === null ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                      <Loader2 className="size-4 animate-spin text-amber-600" /> در حال خواندن آدرس‌های شبکه…
                    </div>
                  ) : netInfo.urls.length === 0 ? (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-card border border-border text-sm leading-6">
                      <Router className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        هیچ کارت شبکه‌ای پیدا نشد. سیستم دفتر باید با کابل یا وای‌فای به روتر/مودم کارگاه وصل باشد؛
                        بعد این صفحه را دوباره باز کنید.
                      </div>
                    </div>
                  ) : (
                    netInfo.urls.map((u) => (
                      <div
                        key={u}
                        className="flex items-center gap-2 p-2.5 ps-4 rounded-xl bg-card border border-border shadow-sm"
                      >
                        <MonitorSmartphone className="size-4.5 text-muted-foreground shrink-0" />
                        <code dir="ltr" className="flex-1 font-bold text-sm sm:text-base text-foreground select-all">
                          {u}
                        </code>
                        <Button size="sm" className="gap-1.5 h-9 font-bold" onClick={() => copyUrl(u)}>
                          {copiedUrl === u ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copiedUrl === u ? 'کپی شد' : 'کپی آدرس'}
                        </Button>
                      </div>
                    ))
                  )}
                  {netInfo && netInfo.port !== 0 && netInfo.ips.length > 0 && (
                    <p className="text-[11px] text-muted-foreground leading-5">
                      اگر هیچ‌کدام از این آدرس‌ها کار نکرد، احتمالاً سیستم دفتر و سیستم نیرو روی یک شبکه نیستند —
                      نکات پایین همین صفحه را ببینید.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* مراحل راه‌اندازی */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Router className="size-4.5 text-amber-600" /> راه‌اندازی — فقط یک‌بار
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3.5 text-sm leading-7">
                    {[
                      <>
                        <b>اتصال همه سیستم‌ها به یک شبکه:</b> سیستم دفتر و سیستم‌های نیروها (هرکدام جدا) همگی با کابل
                        شبکه یا وای‌فای به یک روتر/مودم/سوئیچ مشترک وصل باشند. اینترنت لازم نیست؛ فقط «یک شبکه» بودن مهم است.
                      </>,
                      <>
                        <b>برنامه روی سیستم دفتر باز بماند:</b> همین برنامه‌ای که الان در آن هستید، نقش سرور را دارد —
                        پنجره‌اش را در شیفت کاری نبندید (کمینه کردن مشکلی ندارد).
                      </>,
                      <>
                        <b>آدرس را روی سیستم نیرو باز کنید:</b> آدرس بالا را کپی کنید، روی سیستم نیرو در مرورگر
                        (Chrome یا Edge) وارد کنید و Enter بزنید. صفحه همین برنامه باز می‌شود.
                      </>,
                      <>
                        <b>ثبت‌نام و حضور نیرو:</b> هر نیرو در تب «ثبت‌نام نیرو» با شماره موبایل خودش عضو می‌شود؛ بعد هر روز
                        در داشبورد خودش دکمه ثبت ورود را می‌زند و <b>ساعت دقیق رسیدن</b> را دستی وارد می‌کند (مثلاً ۷:۳۰) و
                        موقع رفتن هم دکمه ثبت خروج با ساعت واقعی. یادداشت هم می‌تواند اضافه کند.
                      </>,
                      <>
                        <b>دیدن لحظه‌ای:</b> از این به بعد هر ثبت نیرو (ورود/خروج، تایم CNC، مساعده، کار روزانه)
                        حداکثر تا ۸ ثانیه بعد، خودکار در داشبورد شما می‌آید.
                      </>,
                    ].map((node, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="size-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {faNum(i + 1)}
                        </span>
                        <span className="min-w-0">{node}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* نکات و رفع اشکال */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">اگر وصل نشد — رفع اشکال</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 text-sm leading-7 text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <b className="text-foreground">فایروال:</b> نصب‌کننده برنامه خودش قانون فایروال را اضافه می‌کند؛
                        اگر باز هم وصل نشد، در ویندوز سیستم دفتر «Windows Security → Firewall → Allow an app» را باز کنید و
                        تیک برنامه اسپاد روی شبکه Private را بزنید.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <b className="text-foreground">آدرس عوض شده:</b> اگر روتر خاموش/روشن شده باشد ممکن است IP سیستم
                        دفتر عوض شود؛ آدرس جدید را از همین صفحه بردارید. برای آدرس همیشگی، در تنظیمات روتر برای سیستم دفتر
                        «DHCP Reservation» (آدرس ثابت) تعیین کنید.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <b className="text-foreground">یک شبکه بودن:</b> سیستم نیرو نباید روی وای‌فای گوشی (هات‌اسپات) باشد؛
                        باید همان شبکه کارگاه باشد. تست ساده: روی سیستم نیرو، در همان آدرسِ بالا، فقط IP را Ping کنید یا
                        آدرس را دوباره از این صفحه کپی کنید.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <b className="text-foreground">اطلاعات:</b> همهٔ داده‌ها فقط روی سیستم دفتر (فایل دیتابیس) ذخیره
                        می‌شود؛ سیستم‌های نیرو هیچ داده‌ای نگه نمی‌دارند. هر چند وقت یک‌بار از سیستم دفتر بکاپ بگیرید.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </main>

        <footer className="mt-auto py-4 text-center text-xs text-muted-foreground border-t border-border space-y-0.5">
          <div>اسپاد مبتکران پیشه · بانک اطلاعات مدیریت کارگاه</div>
          <div>
            توسعه‌دهنده: <span dir="ltr" className="font-semibold">Mostafa Morovati</span>
          </div>
        </footer>
      </div>

      {/* ── گفت‌وگوی بررسی مساعده ── */}
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)} dir="rtl">
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {review?.action === 'APPROVED' ? 'تایید درخواست مساعده' : 'رد درخواست مساعده'}
            </DialogTitle>
            <DialogDescription>
              {review && (
                <>
                  درخواست <b>{review.adv.userName}</b> به مبلغ <b className="text-amber-600 dark:text-amber-400">{faToman(review.adv.amount)}</b>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-note">یادداشت برای نیرو (اختیاری)</Label>
            <Textarea
              id="review-note"
              placeholder={review?.action === 'APPROVED' ? 'مثلاً: پرداخت در نوبت هفته آینده' : 'مثلاً: مساعده قبلی تسویه نشده است'}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReview(null)}>انصراف</Button>
            <Button
              onClick={submitReview}
              disabled={reviewing}
              className={review?.action === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 font-bold' : 'bg-red-600 hover:bg-red-700 font-bold'}
            >
              {reviewing ? <Loader2 className="size-4 animate-spin" /> : null}
              {review?.action === 'APPROVED' ? 'تایید نهایی' : 'رد نهایی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── گفت‌وگوی افزودن/ویرایش نیرو ── */}
      <Dialog open={!!workerDialog} onOpenChange={(o) => !o && setWorkerDialog(null)} dir="rtl">
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{workerDialog?.mode === 'edit' ? 'ویرایش نیرو' : 'افزودن نیروی جدید'}</DialogTitle>
            <DialogDescription>
              {workerDialog?.mode === 'edit'
                ? 'اطلاعات نیرو را اصلاح کنید — برای تغییر رمز، فیلد رمز را پر کنید (اختیاری)'
                : 'حساب نیرو مستقیم ساخته می‌شود تا بلافاصله وارد سامانه شود'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitWorker} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-name">نام و نام خانوادگی *</Label>
              <Input id="w-name" value={wName} onChange={(e) => setWName(e.target.value)} placeholder="مثلاً: رضا کریمی" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="w-phone">موبایل *</Label>
                <Input id="w-phone" dir="ltr" className="text-left" value={wPhone} onChange={(e) => setWPhone(e.target.value)} placeholder="09xxxxxxxxx" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-job">سمت شغلی</Label>
                <Input id="w-job" value={wJob} onChange={(e) => setWJob(e.target.value)} placeholder="اپراتور CNC" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="w-rate">نرخ ساعتی (تومان)</Label>
                <Input id="w-rate" inputMode="numeric" dir="ltr" className="text-left" value={wRate} onChange={(e) => setWRate(e.target.value.replace(/[^\d]/g, ''))} placeholder="180000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-pass">رمز عبور {workerDialog?.mode === 'edit' ? '(تغییر: اختیاری)' : '*'}</Label>
                <Input id="w-pass" type="password" value={wPass} onChange={(e) => setWPass(e.target.value)} placeholder={workerDialog?.mode === 'edit' ? 'بدون تغییر' : 'حداقل ۶ کاراکتر'} required={workerDialog?.mode === 'add'} />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setWorkerDialog(null)}>انصراف</Button>
              <Button type="submit" disabled={savingWorker} className="font-bold">
                {savingWorker ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {workerDialog?.mode === 'edit' ? 'ذخیره تغییرات' : 'افزودن نیرو'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── تأیید حذف نیرو ── */}
      <ConfirmDialog
        open={!!deleteW}
        onOpenChange={(o) => !o && setDeleteW(null)}
        title="حذف نیرو از کارگاه؟"
        desc={
          deleteW
            ? `حساب «${deleteW.name}» و همه رکوردهایش (حضور، CNC، مساعده و کارها) برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.`
            : ''
        }
        confirmText="حذف کامل نیرو"
        destructive
        loading={busyWorkerDel}
        onConfirm={doDeleteWorker}
      />
    </div>
  )
}

// ─── کامپوننت‌های کوچک کمکی ──────────────────────────────

function WorkerFilter({
  value,
  onChange,
  workers,
}: {
  value: string
  onChange: (v: string) => void
  workers: { id: string; name: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange} dir="rtl">
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">همه نیروها</SelectItem>
        {workers.map((w) => (
          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RecordsTable({
  headers,
  rows,
  aligns,
  emptyIcon,
  emptyTitle,
  emptyHint,
}: {
  headers: string[]
  rows: { id: string; cells: React.ReactNode[] }[]
  aligns: ('right' | 'center')[]
  emptyIcon: typeof Clock
  emptyTitle: string
  emptyHint?: string
}) {
  if (rows.length === 0) {
    return <div className="p-2"><EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} /></div>
  }
  return (
    <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar rounded-xl border">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
          <tr className="text-muted-foreground">
            {headers.map((h, i) => (
              <th key={i} className={`py-3 px-4 font-medium ${aligns[i] === 'center' ? 'text-center' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t even:bg-muted/40">
              {r.cells.map((c, i) => (
                <td key={i} className={`py-2.5 px-4 ${aligns[i] === 'center' ? 'text-center' : 'text-right'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function weekdayShort(d: string | Date): string {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(d))
}

function jalaaliToday(): string {
  const j = toJalaali(new Date())
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${j.jy}-${pad(j.jm)}-${pad(j.jd)}`
}

function faDateTimeLabel(): string {
  return `${faDate(new Date())} ساعت ${faTime(new Date())}`
}
