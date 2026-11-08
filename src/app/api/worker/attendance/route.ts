import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

/** ثبت ورود / خروج */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { type, note } = body ?? {}

  if (type !== 'ENTRY' && type !== 'EXIT') {
    return Response.json({ error: 'نوع رکورد نامعتبر است' }, { status: 400 })
  }

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const todayRecords = await db.attendance.findMany({
    where: { userId: user.id, timestamp: { gte: startOfDay } },
    orderBy: { timestamp: 'asc' },
  })

  if (type === 'ENTRY') {
    const hasOpenEntry = todayRecords.some((r) => r.type === 'ENTRY') && !todayRecords.some((r) => r.type === 'EXIT')
    if (hasOpenEntry) {
      return Response.json({ error: 'ورود امروز قبلاً ثبت شده است؛ ابتدا خروج را ثبت کنید' }, { status: 409 })
    }
  } else {
    const last = todayRecords[todayRecords.length - 1]
    if (!last || last.type !== 'ENTRY') {
      return Response.json({ error: 'برای ثبت خروج ابتدا باید ورود ثبت شود' }, { status: 409 })
    }
  }

  const rec = await db.attendance.create({
    data: { userId: user.id, type, note: note?.trim() || null, timestamp: now },
  })

  return Response.json({ attendance: { ...rec, timestamp: rec.timestamp.toISOString() } })
}
