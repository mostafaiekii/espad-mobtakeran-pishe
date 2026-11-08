import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

/** ثبت تایم ماشینکاری CNC */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { machine, partName, material, startTime, endTime, note, status } = body ?? {}

  if (!machine?.trim() || !partName?.trim() || !startTime || !endTime) {
    return Response.json({ error: 'دستگاه، نام قطعه و زمان شروع/پایان الزامی است' }, { status: 400 })
  }

  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return Response.json({ error: 'زمان شروع یا پایان نامعتبر است' }, { status: 400 })
  }
  if (end.getTime() <= start.getTime()) {
    return Response.json({ error: 'زمان پایان باید بعد از زمان شروع باشد' }, { status: 400 })
  }
  if (start.getTime() > Date.now() + 60_000) {
    return Response.json({ error: 'زمان شروع نمی‌تواند در آینده باشد' }, { status: 400 })
  }

  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

  const rec = await db.cncJob.create({
    data: {
      userId: user.id,
      machine: String(machine).trim(),
      partName: String(partName).trim(),
      material: material?.trim() || null,
      startTime: start,
      endTime: end,
      durationMin,
      status: status === 'RUNNING' ? 'RUNNING' : 'DONE',
      note: note?.trim() || null,
    },
  })

  return Response.json({
    cncJob: {
      ...rec,
      startTime: rec.startTime.toISOString(),
      endTime: rec.endTime.toISOString(),
      createdAt: rec.createdAt.toISOString(),
    },
  })
}

/** ویرایش تایم CNC (متعلق به نیروی جاری) */
export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { id, machine, partName, material, startTime, endTime, note, status } = body ?? {}

  if (!id) return Response.json({ error: 'شناسه رکورد الزامی است' }, { status: 400 })

  const existing = await db.cncJob.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (existing.userId !== user.id) return Response.json({ error: 'اجازه ویرایش این رکورد را ندارید' }, { status: 403 })

  if (!machine?.trim() || !partName?.trim() || !startTime || !endTime) {
    return Response.json({ error: 'دستگاه، نام قطعه و زمان شروع/پایان الزامی است' }, { status: 400 })
  }
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return Response.json({ error: 'زمان شروع یا پایان نامعتبر است' }, { status: 400 })
  }
  if (end.getTime() <= start.getTime()) {
    return Response.json({ error: 'زمان پایان باید بعد از زمان شروع باشد' }, { status: 400 })
  }

  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

  const rec = await db.cncJob.update({
    where: { id },
    data: {
      machine: String(machine).trim(),
      partName: String(partName).trim(),
      material: material?.trim() || null,
      startTime: start,
      endTime: end,
      durationMin,
      status: status === 'RUNNING' ? 'RUNNING' : 'DONE',
      note: note?.trim() || null,
    },
  })

  return Response.json({
    cncJob: {
      ...rec,
      startTime: rec.startTime.toISOString(),
      endTime: rec.endTime.toISOString(),
      createdAt: rec.createdAt.toISOString(),
    },
  })
}

/** حذف تایم CNC (متعلق به نیروی جاری) */
export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'شناسه رکورد الزامی است' }, { status: 400 })

  const existing = await db.cncJob.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (existing.userId !== user.id) return Response.json({ error: 'اجازه حذف این رکورد را ندارید' }, { status: 403 })

  await db.cncJob.delete({ where: { id } })
  return Response.json({ ok: true })
}
