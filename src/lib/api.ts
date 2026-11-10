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
