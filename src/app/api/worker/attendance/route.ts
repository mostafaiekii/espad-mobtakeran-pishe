import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

/**
 * ثبت ورود / خروج
 * نیرو می‌تواند ساعت دقیق را دستی وارد کند (مثلاً «۷:۳۰ رسیدم») یا خالی بگذارد تا «همین الان» ثبت شود.
 * ساعت دستی فقط برای «امروز» پذیرفته می‌شود؛ آینده و ساعت قبل از ورودِ امروز پذیرفته نیست.
 */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { type, note, time } = body ?? {}

  if (type !== 'ENTRY' && type !== 'EXIT') {
    return Response.json({ error: 'نوع رکورد نامعتبر است' }, { status: 400 })
  }

  const now = new Date()

  // ── ساخت timestamp از ساعت دستی (HH:MM) ──
  let timestamp = now
  if (typeof time === 'string' && time.trim() !== '') {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(time.trim())
    if (!m) {
      return Response.json({ error: 'فرمت ساعت نامعتبر است — مثال درست: ۷:۳۰' }, { status: 400 })
    }
    const h = Number(m[1])
    const min = Number(m[2])
    if (h < 0 || h > 23 || min < 0 || min > 59) {
      return Response.json({ error: 'ساعت واردشده معتبر نیست (۰ تا ۲۳ ساعت و ۰ تا ۵۹ دقیقه)' }, { status: 400 })
    }
    const d = new Date(now)
    d.setHours(h, min, 0, 0)
    if (d.getTime() > now.getTime() + 60_000) {
      return Response.json({ error: 'ساعت دستی نمی‌تواند در آینده باشد' }, { status: 400 })
    }
    timestamp = d
  }

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
    if (timestamp.getTime() <= last.timestamp.getTime()) {
      return Response.json(
        { error: `ساعت خروج باید بعد از ساعت ورود (${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(last.timestamp)}) باشد` },
        { status: 409 }
      )
    }
  }

  const rec = await db.attendance.create({
    data: { userId: user.id, type, note: note?.trim() || null, timestamp },
  })

  return Response.json({ attendance: { ...rec, timestamp: rec.timestamp.toISOString() } })
}
