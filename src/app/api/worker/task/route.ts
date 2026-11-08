import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

/** ثبت کار / چک‌لیست روزانه */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { title, category, date, note, status } = body ?? {}

  if (!title?.trim()) {
    return Response.json({ error: 'عنوان کار الزامی است' }, { status: 400 })
  }

  const d = date ? new Date(date) : new Date()
  if (isNaN(d.getTime())) {
    return Response.json({ error: 'تاریخ نامعتبر است' }, { status: 400 })
  }

  const rec = await db.taskLog.create({
    data: {
      userId: user.id,
      title: String(title).trim(),
      category: category || 'GENERAL',
      date: d,
      status: status === 'TODO' ? 'TODO' : 'DONE',
      note: note?.trim() || null,
    },
  })

  return Response.json({
    task: { ...rec, date: rec.date.toISOString(), createdAt: rec.createdAt.toISOString() },
  })
}

/** ویرایش کار (متعلق به نیروی جاری) */
export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { id, title, category, date, status, note } = body ?? {}

  if (!id) return Response.json({ error: 'شناسه رکورد الزامی است' }, { status: 400 })
  if (!title?.trim()) {
    return Response.json({ error: 'عنوان کار الزامی است' }, { status: 400 })
  }

  const existing = await db.taskLog.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (existing.userId !== user.id) return Response.json({ error: 'اجازه ویرایش این رکورد را ندارید' }, { status: 403 })

  const d = date ? new Date(date) : existing.date
  if (isNaN(d.getTime())) {
    return Response.json({ error: 'تاریخ نامعتبر است' }, { status: 400 })
  }

  const rec = await db.taskLog.update({
    where: { id },
    data: {
      title: String(title).trim(),
      category: category || existing.category,
      date: d,
      status: status === 'TODO' ? 'TODO' : 'DONE',
      note: note?.trim() || null,
    },
  })

  return Response.json({
    task: { ...rec, date: rec.date.toISOString(), createdAt: rec.createdAt.toISOString() },
  })
}

/** حذف کار (متعلق به نیروی جاری) */
export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'شناسه رکورد الزامی است' }, { status: 400 })

  const existing = await db.taskLog.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (existing.userId !== user.id) return Response.json({ error: 'اجازه حذف این رکورد را ندارید' }, { status: 403 })

  await db.taskLog.delete({ where: { id } })
  return Response.json({ ok: true })
}
