import { db } from '@/lib/db'
import { getUserFromReq, toSessionUser, unauthorized, forbidden } from '@/lib/server-auth'
import type { WorkerSummary } from '@/lib/types'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** بانک اطلاعات مدیریت — همه رکوردها + آمار تجمیعی */
export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const [workers, attendances, cncJobs, advances, tasks, presence, posts] = await Promise.all([
    db.user.findMany({ where: { role: 'WORKER' }, orderBy: { createdAt: 'asc' } }),
    db.attendance.findMany({ orderBy: { timestamp: 'desc' }, take: 500 }),
    db.cncJob.findMany({ orderBy: { startTime: 'desc' }, take: 500 }),
    db.advanceRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
    db.taskLog.findMany({ orderBy: { date: 'desc' }, take: 400 }),
    db.presence.findMany(),
    db.sharedPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { attachments: { select: { id: true, fileName: true, mimeType: true, size: true, downloads: true } } },
    }),
  ])

  const userNames = new Map<string, string>(workers.map((w) => [w.id, w.name]))

  const today = startOfDay(new Date())
  const todayEnd = new Date(today.getTime() + 86400000)
  const weekAgo = new Date(today.getTime() - 6 * 86400000)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const todayAtt = attendances.filter((a) => {
    const t = a.timestamp
    return t >= today && t < todayEnd
  })

  const summaries: WorkerSummary[] = workers.map((w) => {
    const mine = todayAtt.filter((a) => a.userId === w.id)
    const entry = mine.find((a) => a.type === 'ENTRY')
    const lastRec = mine[0] // رکوردهای امروز نزولی‌اند؛ آخرین رکورد وضعیت فعلی را می‌گوید
    const exit = mine.filter((a) => a.type === 'EXIT')
    const myCnc = cncJobs.filter((c) => c.userId === w.id)
    const weekCncMin = myCnc
      .filter((c) => c.startTime >= weekAgo)
      .reduce((s, c) => s + c.durationMin, 0)
    const monthCncMin = myCnc
      .filter((c) => c.startTime >= monthStart)
      .reduce((s, c) => s + c.durationMin, 0)
    const lastAtt = attendances.find((a) => a.userId === w.id)

    return {
      ...toSessionUser(w),
      presentToday: lastRec?.type === 'ENTRY',
      todayEntry: entry?.timestamp.toISOString(),
      todayExit: exit.length ? exit[exit.length - 1].timestamp.toISOString() : undefined,
      weekHours: Math.round(weekCncMin / 60),
      totalCncMin: myCnc.reduce((s, c) => s + c.durationMin, 0),
      monthCncMin,
      pendingAdvances: advances.filter((a) => a.userId === w.id && a.status === 'PENDING').length,
      lastSeen: lastAtt?.timestamp.toISOString(),
    }
  })

  // آمار حضور ۷ روز اخیر
  const weekAttendance = []
  for (let d = 6; d >= 0; d--) {
    const day = new Date(today.getTime() - d * 86400000)
    const dayEnd = new Date(day.getTime() + 86400000)
    weekAttendance.push({
      date: day.toISOString(),
      count: attendances.filter((a) => a.type === 'ENTRY' && a.timestamp >= day && a.timestamp < dayEnd).length,
    })
  }

  // ساعت CNC به تفکیک دستگاه
  const machineMap = new Map<string, number>()
  for (const c of cncJobs) {
    machineMap.set(c.machine, (machineMap.get(c.machine) ?? 0) + c.durationMin)
  }
  const cncByMachine = [...machineMap.entries()]
    .map(([machine, minutes]) => ({ machine, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  const todayCnc = cncJobs.filter((c) => c.startTime >= today && c.startTime < todayEnd)
  const pending = advances.filter((a) => a.status === 'PENDING')

  const stats = {
    totalWorkers: workers.length,
    presentToday: summaries.filter((s) => s.presentToday).length,
    todayCncMin: todayCnc.reduce((s, c) => s + c.durationMin, 0),
    todayCncJobs: todayCnc.length,
    pendingAdvances: pending.length,
    pendingAmount: pending.reduce((s, a) => s + a.amount, 0),
    weekAttendance,
    cncByMachine,
    advanceStatusDist: [
      { name: 'در انتظار', value: advances.filter((a) => a.status === 'PENDING').length, key: 'PENDING' as const },
      { name: 'تایید شده', value: advances.filter((a) => a.status === 'APPROVED').length, key: 'APPROVED' as const },
      { name: 'رد شده', value: advances.filter((a) => a.status === 'REJECTED').length, key: 'REJECTED' as const },
    ],
  }

  return Response.json({
    workers: summaries,
    attendances: attendances.map((a) => ({
      ...a,
      userName: userNames.get(a.userId) ?? '—',
      timestamp: a.timestamp.toISOString(),
    })),
    cncJobs: cncJobs.map((c) => ({
      ...c,
      userName: userNames.get(c.userId) ?? '—',
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    advances: advances.map((a) => ({
      ...a,
      userName: userNames.get(a.userId) ?? '—',
      createdAt: a.createdAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
    })),
    tasks: tasks.map((t) => ({
      ...t,
      userName: userNames.get(t.userId) ?? '—',
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
    presence: presence.map((p) => ({
      userId: p.userId,
      view: p.view,
      userAgent: p.userAgent,
      updatedAt: p.updatedAt.toISOString(),
    })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      createdAt: p.createdAt.toISOString(),
      attachments: p.attachments,
    })),
    stats,
  })
}
