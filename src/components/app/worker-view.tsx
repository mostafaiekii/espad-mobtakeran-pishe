'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppLogo, ConfirmDialog, EmptyState, StatCard, AdvanceStatusBadge } from '@/components/app/ui-bits'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { apiGet, apiPost, apiPatch, apiDelete, clearSession } from '@/lib/api'
import { faNum, faToman, faTime, faDate, faDateShort, faDateTime, faDuration, faHours, toLocalInput, isSameDay } from '@/lib/format'
import { MACHINES, MATERIALS, TASK_CATEGORIES, type SessionUser, type WorkerData, type CncJobRec, type TaskRec, type AdvanceRec } from '@/lib/types'
import {
  LogIn,
  LogOut,
  Clock,
  CalendarCheck,
  Banknote,
  ListChecks,
  Cog,
  RefreshCw,
  Wallet,
  ClipboardList,
  History,
  Factory,
  TimerReset,
  Loader2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'

interface Props {
  user: SessionUser
  onLogout: () => void
}

interface DayPair {
  day: Date
  entry?: Date
  exit?: Date
}

export function WorkerView({ user, onLogout }: Props) {
  const [data, setData] = useState<WorkerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('attendance')

  const [logging, setLogging] = useState(false)
  const [exitConfirm, setExitConfirm] = useState(false)

  // فرم CNC جدید
  const [machine, setMachine] = useState('')
  const [partName, setPartName] = useState('')
  const [material, setMaterial] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [cncNote, setCncNote] = useState('')
  const [savingCnc, setSavingCnc] = useState(false)

  // ویرایش CNC
  const [editCnc, setEditCnc] = useState<CncJobRec | null>(null)
  const [eMachine, setEMachine] = useState('')
  const [ePart, setEPart] = useState('')
  const [eMaterial, setEMaterial] = useState('')
  const [eStart, setEStart] = useState('')
  const [eEnd, setEEnd] = useState('')
  const [eNote, setENote] = useState('')
  const [savingCncEdit, setSavingCncEdit] = useState(false)
  const [deleteCnc, setDeleteCnc] = useState<CncJobRec | null>(null)
  const [busyCncDel, setBusyCncDel] = useState(false)

  // فرم مساعده
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [savingAdvance, setSavingAdvance] = useState(false)
  const [cancelAdv, setCancelAdv] = useState<AdvanceRec | null>(null)
  const [busyAdvCancel, setBusyAdvCancel] = useState(false)

  // فرم کار جدید
  const [taskTitle, setTaskTitle] = useState('')
  const [taskCat, setTaskCat] = useState('GENERAL')
  const [taskDate, setTaskDate] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  // ویرایش کار
  const [editTask, setEditTask] = useState<TaskRec | null>(null)
  const [etTitle, setEtTitle] = useState('')
  const [etCat, setEtCat] = useState('GENERAL')
  const [etDate, setEtDate] = useState('')
  const [etStatus, setEtStatus] = useState('DONE')
  const [savingTaskEdit, setSavingTaskEdit] = useState(false)
  const [deleteTask, setDeleteTask] = useState<TaskRec | null>(null)
  const [busyTaskDel, setBusyTaskDel] = useState(false)

  const refresh = useCallback(async (silent = false) => {
    try {
      const d = await apiGet<WorkerData>('/api/worker/data')
      setData(d)
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const now = new Date()
    setStart(toLocalInput(new Date(now.getTime() - 2 * 3600000)))
    setEnd(toLocalInput(now))
    const d = new Date()
    setTaskDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    refresh()
    // بروزرسانی خودکار هر ۲۰ ثانیه — داده‌ها همیشه تازه می‌مانند
    const iv = setInterval(() => refresh(true), 20000)
    return () => clearInterval(iv)
  }, [refresh])

  // ── محاسبات امروز ──
  const now = new Date()
  const todayRecs = useMemo(
    () => (data ? data.attendances.filter((a) => isSameDay(new Date(a.timestamp), now)) : []),
    [data]
  )
  const lastRec = todayRecs[0] // رکوردها نزولی‌اند؛ اولین = آخرین رکورد امروز
  const todayEntry = todayRecs.find((a) => a.type === 'ENTRY')
  const todayExit = todayRecs.find((a) => a.type === 'EXIT')
  const isPresent = lastRec?.type === 'ENTRY'
  const hasLeft = !!lastRec && lastRec.type === 'EXIT'

  const weekCncMin = useMemo(
    () => (data ? data.cncJobs.filter((c) => Date.now() - new Date(c.startTime).getTime() < 7 * 86400000).reduce((s, c) => s + c.durationMin, 0) : 0),
    [data]
  )
  const monthCncMin = useMemo(() => {
    if (!data) return 0
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return data.cncJobs.filter((c) => new Date(c.startTime) >= monthStart).reduce((s, c) => s + c.durationMin, 0)
  }, [data])

  const pendingAdvance = data?.advances.find((a) => a.status === 'PENDING')
  const cncDurationPreview = useMemo(() => {
    if (!start || !end) return null
    const s = new Date(start)
    const e = new Date(end)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
    return Math.round((e.getTime() - s.getTime()) / 60000)
  }, [start, end])
  const editDurationPreview = useMemo(() => {
    if (!editCnc || !eStart || !eEnd) return null
    const s = new Date(eStart)
    const e = new Date(eEnd)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null
    return Math.round((e.getTime() - s.getTime()) / 60000)
  }, [editCnc, eStart, eEnd])

  // جفت‌کردن ورود/خروج هر روز برای جدول تاریخچه (با پشتیبانی از چند شیفت در روز)
  const dayPairs: DayPair[] = useMemo(() => {
    if (!data) return []
    const byDay = new Map<string, { ts: string; type: string }[]>()
    for (const a of data.attendances) {
      const d = new Date(a.timestamp)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push({ ts: a.timestamp, type: a.type })
    }
    const pairs: DayPair[] = []
    for (const [, recs] of byDay) {
      recs.sort((x, y) => new Date(x.ts).getTime() - new Date(y.ts).getTime())
      const day = new Date(recs[0].ts)
      let open: Date | null = null
      for (const r of recs) {
        const d = new Date(r.ts)
        if (r.type === 'ENTRY') {
          if (!open) open = d
        } else if (open) {
          pairs.push({ day, entry: open, exit: d })
          open = null
        }
      }
      if (open) pairs.push({ day, entry: open, exit: null })
    }
    return pairs.sort((a, b) => (b.entry?.getTime() ?? 0) - (a.entry?.getTime() ?? 0))
  }, [data])

  // ── اکشن‌ها ──
  async function logAttendance(type: 'ENTRY' | 'EXIT') {
    setLogging(true)
    try {
      await apiPost('/api/worker/attendance', { type })
      toast.success(type === 'ENTRY' ? 'ورود شما ثبت شد ✅' : 'خروج شما ثبت شد 👋')
      setExitConfirm(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت')
    } finally {
      setLogging(false)
    }
  }

  async function submitCnc(e: React.FormEvent) {
    e.preventDefault()
    if (!machine || !partName.trim()) {
      toast.error('دستگاه و نام قطعه را وارد کنید')
      return
    }
    if (!cncDurationPreview) {
      toast.error('زمان پایان باید بعد از زمان شروع باشد')
      return
    }
    setSavingCnc(true)
    try {
      await apiPost('/api/worker/cnc', { machine, partName, material, startTime: start, endTime: end, note: cncNote })
      toast.success('تایم ماشین‌کاری ثبت شد 🛠️')
      setPartName('')
      setCncNote('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت CNC')
    } finally {
      setSavingCnc(false)
    }
  }

  function openEditCnc(c: CncJobRec) {
    setEditCnc(c)
    setEMachine(c.machine)
    setEPart(c.partName)
    setEMaterial(c.material || '')
    setEStart(toLocalInput(new Date(c.startTime)))
    setEEnd(toLocalInput(new Date(c.endTime)))
    setENote(c.note || '')
  }

  async function submitCncEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editCnc) return
    if (!editDurationPreview) {
      toast.error('زمان پایان باید بعد از زمان شروع باشد')
      return
    }
    setSavingCncEdit(true)
    try {
      await apiPatch('/api/worker/cnc', {
        id: editCnc.id,
        machine: eMachine,
        partName: ePart,
        material: eMaterial,
        startTime: eStart,
        endTime: eEnd,
        note: eNote,
      })
      toast.success('رکورد CNC ویرایش شد ✏️')
      setEditCnc(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ویرایش')
    } finally {
      setSavingCncEdit(false)
    }
  }

  async function doDeleteCnc() {
    if (!deleteCnc) return
    setBusyCncDel(true)
    try {
      await apiDelete(`/api/worker/cnc?id=${deleteCnc.id}`)
      toast.success('رکورد CNC حذف شد 🗑️')
      setDeleteCnc(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف')
    } finally {
      setBusyCncDel(false)
    }
  }

  async function submitAdvance(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt) {
      toast.error('مبلغ درخواست را وارد کنید')
      return
    }
    if (!reason.trim()) {
      toast.error('دلیل درخواست را بنویسید')
      return
    }
    setSavingAdvance(true)
    try {
      await apiPost('/api/worker/advance', { amount: amt, reason })
      toast.success('درخواست مساعده برای مدیر ارسال شد 📤')
      setAmount('')
      setReason('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت درخواست')
    } finally {
      setSavingAdvance(false)
    }
  }

  async function doCancelAdvance() {
    if (!cancelAdv) return
    setBusyAdvCancel(true)
    try {
      await apiDelete(`/api/worker/advance?id=${cancelAdv.id}`)
      toast.success('درخواست لغو شد')
      setCancelAdv(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در لغو')
    } finally {
      setBusyAdvCancel(false)
    }
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) {
      toast.error('عنوان کار را وارد کنید')
      return
    }
    setSavingTask(true)
    try {
      await apiPost('/api/worker/task', { title: taskTitle, category: taskCat, date: taskDate })
      toast.success('کار ثبت شد ✅')
      setTaskTitle('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت کار')
    } finally {
      setSavingTask(false)
    }
  }

  function openEditTask(t: TaskRec) {
    setEditTask(t)
    setEtTitle(t.title)
    setEtCat(t.category)
    const d = new Date(t.date)
    setEtDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    setEtStatus(t.status)
  }

  async function submitTaskEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTask) return
    if (!etTitle.trim()) {
      toast.error('عنوان کار الزامی است')
      return
    }
    setSavingTaskEdit(true)
    try {
      await apiPatch('/api/worker/task', { id: editTask.id, title: etTitle, category: etCat, date: etDate, status: etStatus })
      toast.success('کار ویرایش شد ✏️')
      setEditTask(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ویرایش')
    } finally {
      setSavingTaskEdit(false)
    }
  }

  async function doDeleteTask() {
    if (!deleteTask) return
    setBusyTaskDel(true)
    try {
      await apiDelete(`/api/worker/task?id=${deleteTask.id}`)
      toast.success('کار حذف شد 🗑️')
      setDeleteTask(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف')
    } finally {
      setBusyTaskDel(false)
    }
  }

  function logout() {
    clearSession()
    onLogout()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── هدر ── */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AppLogo size="sm" />
            <ThemeToggle />
            <Badge variant="secondary" className="hidden sm:inline-flex bg-amber-100 text-amber-800 border-amber-200">
              داشبورد نیرو
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refresh()} title="به‌روزرسانی">
              <RefreshCw className="size-4" />
            </Button>
            <div className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-amber-50 border border-amber-200">
              <div className="size-7 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                {user.name.charAt(0)}
              </div>
              <div className="leading-none hidden sm:block">
                <div className="text-xs font-bold">{user.name}</div>
                <div className="text-[10px] text-muted-foreground">{user.jobTitle || 'نیروی کارگاه'}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="خروج از حساب">
              <LogOut className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── وضعیت امروز ── */}
        <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-l from-amber-600 to-amber-500 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium opacity-90">{faDate(now)} · {faWeekdayName(now)}</div>
              {isPresent && (
                <>
                  <div className="text-xl sm:text-2xl font-black">حاضر در کارگاه ✅</div>
                  <div className="text-sm opacity-90">ورود از ساعت {faTime(todayEntry!.timestamp)}</div>
                </>
              )}
              {hasLeft && (
                <>
                  <div className="text-xl sm:text-2xl font-black">کار امروز ثبت شد 👍</div>
                  <div className="text-sm opacity-90">
                    ورود {faTime(todayEntry!.timestamp)} · خروج {faTime(todayExit!.timestamp)}
                  </div>
                </>
              )}
              {!todayEntry && (
                <>
                  <div className="text-xl sm:text-2xl font-black">امروز هنوز وارد نشده‌اید</div>
                  <div className="text-sm opacity-90">با دکمه زیر ورود خود را ثبت کنید</div>
                </>
              )}
            </div>
            {!hasLeft && (
              <Button
                onClick={() => (isPresent ? setExitConfirm(true) : logAttendance('ENTRY'))}
                disabled={logging}
                size="lg"
                className={
                  isPresent
                    ? 'h-12 px-6 text-base font-bold bg-white text-red-600 hover:bg-red-50 shadow-lg'
                    : 'h-12 px-6 text-base font-bold bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg'
                }
              >
                {logging ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : isPresent ? (
                  <>
                    <LogOut className="size-5" /> ثبت خروج
                  </>
                ) : (
                  <>
                    <LogIn className="size-5" /> ثبت ورود
                  </>
                )}
              </Button>
            )}
          </div>
        </section>

        {/* ── آمار خلاصه ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="ماشین‌کاری این هفته" value={faHours(Math.round(weekCncMin / 60))} tone="amber" />
          <StatCard icon={CalendarCheck} label="ماشین‌کاری این ماه" value={faHours(Math.round(monthCncMin / 60))} tone="teal" />
          <StatCard
            icon={Banknote}
            label="درخواست‌های مساعده"
            value={`${faNum(data?.advances.length ?? 0)} مورد`}
            sub={pendingAdvance ? 'یک درخواست در انتظار بررسی' : data?.advances[0] ? 'آخرین: بررسی شده' : 'بدون درخواست'}
            tone="emerald"
          />
          <StatCard icon={ListChecks} label="کارهای ثبت‌شده" value={`${faNum(data?.tasks.length ?? 0)} مورد`} tone="stone" />
        </section>

        {/* ── تب‌ها ── */}
        <Tabs value={tab} onValueChange={setTab} dir="rtl" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full h-auto min-h-12 max-w-2xl p-1">
            <TabsTrigger value="attendance" className="gap-1 sm:gap-1.5 py-2">
              <Clock className="size-4" /> <span className="text-xs sm:text-sm">حضور</span>
            </TabsTrigger>
            <TabsTrigger value="cnc" className="gap-1 sm:gap-1.5 py-2">
              <Cog className="size-4" /> <span className="text-xs sm:text-sm">ماشین‌کاری</span>
            </TabsTrigger>
            <TabsTrigger value="advance" className="gap-1 sm:gap-1.5 py-2">
              <Wallet className="size-4" /> <span className="text-xs sm:text-sm">مساعده</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 sm:gap-1.5 py-2">
              <ClipboardList className="size-4" /> <span className="text-xs sm:text-sm">کارها</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ حضور و غیاب ═══ */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4 text-amber-600" /> سابقه حضور و غیاب
                </CardTitle>
                <CardDescription>ورود و خروج هر روز به‌صورت خودکار در دفتر مدیریت ثبت می‌شود — رکوردهای حضور قابل ویرایش نیستند</CardDescription>
              </CardHeader>
              <CardContent>
                {dayPairs.length === 0 ? (
                  <EmptyState icon={Clock} title="هنوز رکوردی ثبت نشده" hint="اولین ورود خود را از کارت بالای صفحه ثبت کنید" />
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                        <tr className="text-muted-foreground">
                          <th className="py-2.5 px-3 text-right font-medium">روز</th>
                          <th className="py-2.5 px-3 text-center font-medium">ورود</th>
                          <th className="py-2.5 px-3 text-center font-medium">خروج</th>
                          <th className="py-2.5 px-3 text-center font-medium">مدت حضور</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayPairs.map((p, i) => {
                          const dur = p.entry && p.exit ? Math.round((p.exit.getTime() - p.entry.getTime()) / 60000) : null
                          return (
                            <tr key={i} className="border-t even:bg-muted/40">
                              <td className="py-2.5 px-3">
                                <div className="font-medium">{faWeekdayName(p.day)}</div>
                                <div className="text-[11px] text-muted-foreground">{faDateShort(p.day)}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono" dir="ltr">{p.entry ? faTime(p.entry) : '—'}</td>
                              <td className="py-2.5 px-3 text-center font-mono" dir="ltr">{p.exit ? faTime(p.exit) : '—'}</td>
                              <td className="py-2.5 px-3 text-center">
                                {dur !== null ? <Badge variant="secondary" className="bg-amber-100 text-amber-800">{faDuration(dur)}</Badge> : <span className="text-muted-foreground text-xs">در جریان…</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ CNC ═══ */}
          <TabsContent value="cnc" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Factory className="size-4 text-amber-600" /> ثبت تایم ماشین‌کاری جدید
                </CardTitle>
                <CardDescription>دستگاه، قطعه و بازه کاری را ثبت کنید — بعداً هم قابل ویرایش است</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCnc} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>دستگاه *</Label>
                    <Select value={machine} onValueChange={setMachine} dir="rtl">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="انتخاب دستگاه" />
                      </SelectTrigger>
                      <SelectContent>
                        {MACHINES.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="part">نام قطعه *</Label>
                    <Input id="part" placeholder="مثلاً فلنج ۶ اینچ" value={partName} onChange={(e) => setPartName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>جنس</Label>
                    <Select value={material} onValueChange={setMaterial} dir="rtl">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="انتخاب جنس" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIALS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnc-start">زمان شروع *</Label>
                    <Input id="cnc-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnc-end">زمان پایان *</Label>
                    <Input id="cnc-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnc-note">یادداشت</Label>
                    <Input id="cnc-note" placeholder="اختیاری" value={cncNote} onChange={(e) => setCncNote(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <TimerReset className="size-4 text-amber-600" />
                      {cncDurationPreview ? (
                        <span>
                          مدت‌زمان ماشین‌کاری: <b className="text-foreground">{faDuration(cncDurationPreview)}</b>
                        </span>
                      ) : (
                        <span>زمان شروع و پایان را مشخص کنید</span>
                      )}
                    </div>
                    <Button type="submit" disabled={savingCnc} className="font-bold">
                      {savingCnc ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      ثبت تایم CNC
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ماشین‌کاری‌های من ({faNum(data?.cncJobs.length ?? 0)})</CardTitle>
                <CardDescription>اگر ساعت یا اطلاعات قطعه‌ای را اشتباه وارد کرده‌اید، از دکمه‌های ویرایش و حذف استفاده کنید</CardDescription>
              </CardHeader>
              <CardContent>
                {!data?.cncJobs.length ? (
                  <EmptyState icon={Factory} title="هنوز تایمی ثبت نکرده‌اید" hint="با فرم بالا اولین تایم ماشین‌کاری را ثبت کنید" />
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                        <tr className="text-muted-foreground">
                          <th className="py-2.5 px-3 text-right font-medium">قطعه</th>
                          <th className="py-2.5 px-3 text-right font-medium">دستگاه</th>
                          <th className="py-2.5 px-3 text-center font-medium hidden md:table-cell">جنس</th>
                          <th className="py-2.5 px-3 text-center font-medium">تاریخ</th>
                          <th className="py-2.5 px-3 text-center font-medium">مدت</th>
                          <th className="py-2.5 px-3 text-center font-medium">وضعیت</th>
                          <th className="py-2.5 px-3 text-center font-medium">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cncJobs.map((c) => (
                          <tr key={c.id} className="border-t even:bg-muted/40">
                            <td className="py-2.5 px-3">
                              <div className="font-medium">{c.partName}</div>
                              {c.note && <div className="text-[11px] text-muted-foreground truncate max-w-40">{c.note}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{c.machine}</td>
                            <td className="py-2.5 px-3 text-center text-muted-foreground hidden md:table-cell">{c.material || '—'}</td>
                            <td className="py-2.5 px-3 text-center text-xs">{faDateShort(c.startTime)}</td>
                            <td className="py-2.5 px-3 text-center font-medium">{faDuration(c.durationMin)}</td>
                            <td className="py-2.5 px-3 text-center">
                              {c.status === 'RUNNING' ? (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> در جریان
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">تمام‌شده</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="size-7" title="ویرایش" onClick={() => openEditCnc(c)}>
                                  <Pencil className="size-3.5 text-teal-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-7" title="حذف" onClick={() => setDeleteCnc(c)}>
                                  <Trash2 className="size-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ مساعده ═══ */}
          <TabsContent value="advance" className="space-y-4">
            {pendingAdvance && (
              <div className="flex items-center justify-between gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-900 dark:text-amber-200 text-sm">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    درخواست <b>{faToman(pendingAdvance.amount)}</b> شما در انتظار بررسی مدیریت است.
                  </span>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setCancelAdv(pendingAdvance)}>
                  لغو درخواست
                </Button>
              </div>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4 text-amber-600" /> درخواست مساعده جدید
                </CardTitle>
                <CardDescription>درخواست شما مستقیم به دفتر مدیریت ارسال می‌شود و نتیجه همین‌جا نمایش داده می‌شود</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitAdvance} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="adv-amount">مبلغ (تومان) *</Label>
                      <Input
                        id="adv-amount"
                        inputMode="numeric"
                        dir="ltr"
                        className="text-left font-bold text-lg h-12"
                        placeholder="3,000,000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                      />
                      {amount && <div className="text-xs text-muted-foreground">{faToman(Number(amount))}</div>}
                    </div>
                    <div className="space-y-1.5 sm:row-span-2">
                      <Label htmlFor="adv-reason">دلیل درخواست *</Label>
                      <Textarea
                        id="adv-reason"
                        placeholder="مثلاً: مصارف خانوادگی، تعمیر خودرو…"
                        className="h-full min-h-24 resize-none"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingAdvance || !!pendingAdvance} className="font-bold h-11 px-6">
                      {savingAdvance ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                      ارسال درخواست به مدیریت
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">درخواست‌های من ({faNum(data?.advances.length ?? 0)})</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.advances.length ? (
                  <EmptyState icon={Banknote} title="هنوز درخواستی نداشته‌اید" />
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2.5">
                    {data.advances.map((a) => (
                      <div key={a.id} className="p-3.5 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-amber-600 dark:text-amber-400">{faToman(a.amount)}</div>
                          <div className="text-sm text-muted-foreground truncate">{a.reason}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">{faDateTime(a.createdAt)}</div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <AdvanceStatusBadge status={a.status} />
                          {a.reviewNote && <div className="text-[11px] text-muted-foreground max-w-56">💬 {a.reviewNote}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ کارها ═══ */}
          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="size-4 text-amber-600" /> ثبت کار انجام‌شده
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitTask} className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="task-title">عنوان کار *</Label>
                    <Input id="task-title" placeholder="مثلاً: روغن‌کاری و سرویس دستگاه" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>دسته‌بندی</Label>
                    <Select value={taskCat} onValueChange={setTaskCat} dir="rtl">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map((c) => (
                          <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-date">تاریخ</Label>
                    <Input id="task-date" type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 flex items-end justify-end">
                    <Button type="submit" disabled={savingTask} className="font-bold">
                      {savingTask ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      ثبت کار
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">کارهای ثبت‌شده ({faNum(data?.tasks.length ?? 0)})</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.tasks.length ? (
                  <EmptyState icon={ListChecks} title="هنوز کاری ثبت نشده" />
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                        <tr className="text-muted-foreground">
                          <th className="py-2.5 px-3 text-right font-medium">کار</th>
                          <th className="py-2.5 px-3 text-center font-medium hidden sm:table-cell">دسته</th>
                          <th className="py-2.5 px-3 text-center font-medium">تاریخ</th>
                          <th className="py-2.5 px-3 text-center font-medium">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.tasks.map((t) => (
                          <tr key={t.id} className="border-t even:bg-muted/40">
                            <td className="py-2.5 px-3 font-medium">{t.title}</td>
                            <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                              <Badge variant="outline" className="bg-transparent">{categoryLabel(t.category)}</Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{faDateShort(t.date)}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="size-7" title="ویرایش" onClick={() => openEditTask(t)}>
                                  <Pencil className="size-3.5 text-teal-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-7" title="حذف" onClick={() => setDeleteTask(t)}>
                                  <Trash2 className="size-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto py-4 text-center text-xs text-muted-foreground border-t border-border space-y-0.5">
        <div>اسپاد مبتکران پیشه · همه گزارش‌ها به‌صورت زنده در پنل مدیریت ثبت می‌شود</div>
        <div>
          توسعه‌دهنده: <span dir="ltr" className="font-semibold">Mostafa Morovati</span>
        </div>
      </footer>

      {/* ── تأیید ثبت خروج ── */}
      <ConfirmDialog
        open={exitConfirm}
        onOpenChange={setExitConfirm}
        title="ثبت خروج از کارگاه؟"
        desc={`ساعت خروج شما ${faTime(new Date())} ثبت خواهد شد و امروز دیگر قابل ثبت ورود نیست. مطمئن هستید؟`}
        confirmText="بله، خروج را ثبت کن"
        onConfirm={() => logAttendance('EXIT')}
      />

      {/* ── حذف رکورد CNC ── */}
      <ConfirmDialog
        open={!!deleteCnc}
        onOpenChange={(o) => !o && setDeleteCnc(null)}
        title="حذف رکورد ماشین‌کاری؟"
        desc={deleteCnc ? `«${deleteCnc.partName}» روی ${deleteCnc.machine} (${faDuration(deleteCnc.durationMin)}) حذف خواهد شد.` : ''}
        confirmText="حذف کن"
        destructive
        loading={busyCncDel}
        onConfirm={doDeleteCnc}
      />

      {/* ── حذف کار ── */}
      <ConfirmDialog
        open={!!deleteTask}
        onOpenChange={(o) => !o && setDeleteTask(null)}
        title="حذف این کار؟"
        desc={deleteTask ? `«${deleteTask.title}» حذف خواهد شد.` : ''}
        confirmText="حذف کن"
        destructive
        loading={busyTaskDel}
        onConfirm={doDeleteTask}
      />

      {/* ── لغو درخواست مساعده ── */}
      <ConfirmDialog
        open={!!cancelAdv}
        onOpenChange={(o) => !o && setCancelAdv(null)}
        title="لغو درخواست مساعده؟"
        desc={cancelAdv ? `درخواست ${faToman(cancelAdv.amount)} لغو خواهد شد و به مدیر نمایش داده نمی‌شود.` : ''}
        confirmText="لغو درخواست"
        destructive
        loading={busyAdvCancel}
        onConfirm={doCancelAdvance}
      />

      {/* ── ویرایش رکورد CNC ── */}
      <Dialog open={!!editCnc} onOpenChange={(o) => !o && setEditCnc(null)} dir="rtl">
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ویرایش تایم ماشین‌کاری</DialogTitle>
            <DialogDescription>ساعت‌ها و اطلاعات قطعه را اصلاح کنید — تغییری که اعمال شود در پنل مدیریت هم به‌روز می‌شود</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCncEdit} className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>دستگاه *</Label>
              <Select value={eMachine} onValueChange={setEMachine} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب دستگاه" />
                </SelectTrigger>
                <SelectContent>
                  {MACHINES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-part">نام قطعه *</Label>
              <Input id="e-part" value={ePart} onChange={(e) => setEPart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>جنس</Label>
              <Select value={eMaterial} onValueChange={setEMaterial} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب جنس" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-note">یادداشت</Label>
              <Input id="e-note" value={eNote} onChange={(e) => setENote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-start">زمان شروع *</Label>
              <Input id="e-start" type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-end">زمان پایان *</Label>
              <Input id="e-end" type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
            </div>
            <div className="sm:col-span-2 text-sm text-muted-foreground flex items-center gap-1.5">
              <TimerReset className="size-4 text-amber-600" />
              {editDurationPreview ? (
                <span>مدت جدید: <b className="text-foreground">{faDuration(editDurationPreview)}</b></span>
              ) : (
                <span>زمان پایان باید بعد از زمان شروع باشد</span>
              )}
            </div>
            <DialogFooter className="sm:col-span-2 gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditCnc(null)}>انصراف</Button>
              <Button type="submit" disabled={savingCncEdit} className="font-bold">
                {savingCncEdit ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                ذخیره تغییرات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ویرایش کار ── */}
      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} dir="rtl">
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ویرایش کار</DialogTitle>
            <DialogDescription>اطلاعات کار ثبت‌شده را اصلاح کنید</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTaskEdit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-title">عنوان کار *</Label>
              <Input id="et-title" value={etTitle} onChange={(e) => setEtTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>دسته‌بندی</Label>
                <Select value={etCat} onValueChange={setEtCat} dir="rtl">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="et-date">تاریخ</Label>
                <Input id="et-date" type="date" value={etDate} onChange={(e) => setEtDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>وضعیت</Label>
              <Select value={etStatus} onValueChange={setEtStatus} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONE">انجام‌شده</SelectItem>
                  <SelectItem value="TODO">در جریان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditTask(null)}>انصراف</Button>
              <Button type="submit" disabled={savingTaskEdit} className="font-bold">
                {savingTaskEdit ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                ذخیره تغییرات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function faWeekdayName(d: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(d)
}

function categoryLabel(key: string): string {
  return TASK_CATEGORIES.find((c) => c.key === key)?.label ?? key
}
