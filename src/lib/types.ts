// تایپ‌های مشترک بین فرانت و بک‌اند
// تاریخ‌ها در JSON به رشته تبدیل می‌شوند

export type Role = 'WORKER' | 'MANAGER'
export type AttendanceType = 'ENTRY' | 'EXIT'
export type AdvanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type TaskStatus = 'TODO' | 'DONE'
export type CncStatus = 'RUNNING' | 'DONE'

export interface SessionUser {
  id: string
  name: string
  phone: string
  role: Role
  jobTitle: string | null
  hourlyRate: number
  createdAt: string
}

export interface AttendanceRec {
  id: string
  userId: string
  userName?: string
  type: AttendanceType
  timestamp: string
  note?: string | null
}

export interface CncJobRec {
  id: string
  userId: string
  userName?: string
  machine: string
  partName: string
  material?: string | null
  startTime: string
  endTime: string
  durationMin: number
  status: CncStatus
  note?: string | null
  createdAt: string
}

export interface AdvanceRec {
  id: string
  userId: string
  userName?: string
  amount: number
  reason: string
  status: AdvanceStatus
  reviewNote?: string | null
  reviewedAt?: string | null
  createdAt: string
}

export interface TaskRec {
  id: string
  userId: string
  userName?: string
  title: string
  category: string
  date: string
  status: TaskStatus
  note?: string | null
  createdAt: string
}

// ─── اطلاعیه‌ها و فایل‌ها ────────────────────────────────
export interface AttachmentMeta {
  id: string
  fileName: string
  mimeType: string
  size: number
  downloads: number
}

export interface PostRec {
  id: string
  title: string
  body: string
  createdAt: string
  attachments: AttachmentMeta[]
}

// ─── پایش زنده ───────────────────────────────────────────
export interface PresenceRec {
  userId: string
  view: string
  userAgent: string
  updatedAt: string
}

/** برچسب فارسی صفحات برنامه — برای پایش زنده مدیر */
export const VIEW_LABELS: Record<string, string> = {
  attendance: 'حضور و غیاب',
  cnc: 'ماشین‌کاری CNC',
  advance: 'درخواست مساعده',
  tasks: 'چک‌لیست کارها',
  posts: 'اطلاعیه‌ها و فایل‌ها',
  guide: 'راهنمای اتصال',
  home: 'صفحه اصلی',
}

export interface WorkerSummary extends SessionUser {
  presentToday: boolean
  todayEntry?: string
  todayExit?: string
  weekHours: number
  totalCncMin: number
  monthCncMin: number
  pendingAdvances: number
  lastSeen?: string
}

export interface DayStat {
  date: string
  count: number
}

export interface MachineStat {
  machine: string
  minutes: number
}

export interface AdminStats {
  totalWorkers: number
  presentToday: number
  todayCncMin: number
  todayCncJobs: number
  pendingAdvances: number
  pendingAmount: number
  weekAttendance: DayStat[]
  cncByMachine: MachineStat[]
  advanceStatusDist: { name: string; value: number; key: AdvanceStatus }[]
}

export interface WorkerData {
  user: SessionUser
  attendances: AttendanceRec[]
  cncJobs: CncJobRec[]
  advances: AdvanceRec[]
  tasks: TaskRec[]
  posts: PostRec[]
}

export interface AdminData {
  workers: WorkerSummary[]
  attendances: AttendanceRec[]
  cncJobs: CncJobRec[]
  advances: AdvanceRec[]
  tasks: TaskRec[]
  presence: PresenceRec[]
  posts: PostRec[]
  stats: AdminStats
}

export const MACHINES = ['CNC فرز ۱', 'CNC فرز ۲', 'CNC تراش ۱', 'CNC تراش ۲', 'وایرکات'] as const
export const MATERIALS = ['آلومینیوم', 'فولاد ST37', 'استیل ۳۰۴', 'برنج', 'چدن'] as const
export const TASK_CATEGORIES: { key: string; label: string }[] = [
  { key: 'GENERAL', label: 'عمومی' },
  { key: 'MAINTENANCE', label: 'تعمیرات و نگهداری' },
  { key: 'QUALITY', label: 'کنترل کیفیت' },
  { key: 'PACKAGING', label: 'بسته‌بندی' },
  { key: 'SAFETY', label: 'ایمنی' },
]
