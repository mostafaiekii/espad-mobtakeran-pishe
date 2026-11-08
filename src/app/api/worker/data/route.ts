import { db } from '@/lib/db'
import { getUserFromReq, toSessionUser, unauthorized } from '@/lib/server-auth'

/** همه داده‌های نیروی جاری در یک پاسخ */
export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const [attendances, cncJobs, advances, tasks] = await Promise.all([
    db.attendance.findMany({ where: { userId: user.id }, orderBy: { timestamp: 'desc' }, take: 200 }),
    db.cncJob.findMany({ where: { userId: user.id }, orderBy: { startTime: 'desc' }, take: 200 }),
    db.advanceRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.taskLog.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 200 }),
  ])

  return Response.json({
    user: toSessionUser(user),
    attendances: attendances.map((a) => ({ ...a, timestamp: a.timestamp.toISOString() })),
    cncJobs: cncJobs.map((c) => ({
      ...c,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    advances: advances.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
    })),
    tasks: tasks.map((t) => ({ ...t, date: t.date.toISOString(), createdAt: t.createdAt.toISOString() })),
  })
}
