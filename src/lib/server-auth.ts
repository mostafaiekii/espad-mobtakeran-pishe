import { db } from '@/lib/db'
import type { User } from '@prisma/client'
import type { SessionUser } from '@/lib/types'

/** خواندن کاربر جاری از هدر x-user-id (نشست ساده — برای نسخه تک‌کاربره/شبکه محلی) */
export async function getUserFromReq(req: Request): Promise<User | null> {
  const id = req.headers.get('x-user-id')
  if (!id) return null
  const user = await db.user.findUnique({ where: { id } })
  return user ?? null
}

export function toSessionUser(u: User): SessionUser {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role as SessionUser['role'],
    jobTitle: u.jobTitle,
    hourlyRate: u.hourlyRate,
    createdAt: u.createdAt.toISOString(),
  }
}

export function unauthorized(msg = 'ابتدا وارد شوید') {
  return Response.json({ error: msg }, { status: 401 })
}

export function forbidden(msg = 'دسترسی فقط برای مدیر مجاز است') {
  return Response.json({ error: msg }, { status: 403 })
}
