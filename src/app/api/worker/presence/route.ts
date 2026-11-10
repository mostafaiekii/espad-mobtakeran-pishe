import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * تپ قلب پایش زنده — کلاینت نیرو هر چند ثانیه صفحه فعلی را گزارش می‌کند
 * تا مدیر در بخش «پایش زنده» ببیند هر نیرو الان کجای برنامه است.
 */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const view = String(body?.view ?? 'attendance').slice(0, 32)
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300)

  await db.presence.upsert({
    where: { userId: user.id },
    update: { view, userAgent, updatedAt: new Date() },
    create: { userId: user.id, view, userAgent },
  })

  return Response.json({ ok: true })
}
