import type { SessionUser } from '@/lib/types'

const SESSION_KEY = 'spad_session'

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function setSession(u: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(u))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function headers(): HeadersInit {
  const u = getSession()
  return {
    'Content-Type': 'application/json',
    ...(u ? { 'x-user-id': u.id } : {}),
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'خطای ارتباط با سرور')
  }
  return data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers(), cache: 'no-store' })
  return handle<T>(res)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  return handle<T>(res)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  })
  return handle<T>(res)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: headers(),
  })
  return handle<T>(res)
}

/** ارسال فرم multipart (آپلود فایل اطلاعیه‌ها) — بدون Content-Type دستی تا مرورگر boundary بگذارد */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const u = getSession()
  const res = await fetch(path, {
    method: 'POST',
    headers: u ? { 'x-user-id': u.id } : undefined,
    body: form,
  })
  return handle<T>(res)
}

/** دانلود پیوست با احراز هویت و ذخیره روی دستگاه نیرو/مدیر */
export async function downloadAttachment(id: string, fileName: string): Promise<void> {
  const u = getSession()
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    headers: u ? { 'x-user-id': u.id } : undefined,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('دانلود فایل ناموفق بود')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
