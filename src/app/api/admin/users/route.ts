import { db } from '@/lib/db'
import { getUserFromReq, toSessionUser, unauthorized, forbidden } from '@/lib/server-auth'

/** افزودن نیرو توسط مدیر */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const body = await req.json().catch(() => ({}))
  const { name, phone, password, jobTitle, hourlyRate } = body ?? {}

  if (!name?.trim() || !phone?.trim() || !password) {
    return Response.json({ error: 'نام، موبایل و رمز الزامی است' }, { status: 400 })
  }
  if (!/^09\d{9}$/.test(String(phone).trim())) {
    return Response.json({ error: 'شماره موبایل نامعتبر است' }, { status: 400 })
  }

  const exists = await db.user.findUnique({ where: { phone: String(phone).trim() } })
  if (exists) {
    return Response.json({ error: 'این شماره قبلاً ثبت شده است' }, { status: 409 })
  }

  const created = await db.user.create({
    data: {
      name: String(name).trim(),
      phone: String(phone).trim(),
      password: String(password),
      role: 'WORKER',
      jobTitle: jobTitle?.trim() || null,
      hourlyRate: Number(hourlyRate) || 0,
    },
  })

  return Response.json({ user: toSessionUser(created) })
}

/** ویرایش نیرو توسط مدیر */
export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const body = await req.json().catch(() => ({}))
  const { id, name, phone, jobTitle, hourlyRate, password } = body ?? {}

  if (!id) return Response.json({ error: 'شناسه نیرو الزامی است' }, { status: 400 })

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'نیرو یافت نشد' }, { status: 404 })
  if (existing.role !== 'WORKER') return Response.json({ error: 'حساب مدیریتی قابل ویرایش از این بخش نیست' }, { status: 403 })

  if (!name?.trim() || !phone?.trim()) {
    return Response.json({ error: 'نام و شماره موبایل الزامی است' }, { status: 400 })
  }
  if (!/^09\d{9}$/.test(String(phone).trim())) {
    return Response.json({ error: 'شماره موبایل نامعتبر است' }, { status: 400 })
  }
  if (password && String(password).length < 6) {
    return Response.json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, { status: 400 })
  }

  const phoneTaken = await db.user.findUnique({ where: { phone: String(phone).trim() } })
  if (phoneTaken && phoneTaken.id !== id) {
    return Response.json({ error: 'این شماره برای نیروی دیگری ثبت شده است' }, { status: 409 })
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      name: String(name).trim(),
      phone: String(phone).trim(),
      jobTitle: jobTitle?.trim() || null,
      hourlyRate: Number(hourlyRate) || 0,
      ...(password ? { password: String(password) } : {}),
    },
  })

  return Response.json({ user: toSessionUser(updated) })
}

/** حذف نیرو و همه رکوردهایش توسط مدیر */
export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'شناسه نیرو الزامی است' }, { status: 400 })

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'نیرو یافت نشد' }, { status: 404 })
  if (existing.role !== 'WORKER') {
    return Response.json({ error: 'حساب مدیریتی قابل حذف نیست' }, { status: 403 })
  }

  await db.$transaction([
    db.attendance.deleteMany({ where: { userId: id } }),
    db.cncJob.deleteMany({ where: { userId: id } }),
    db.advanceRequest.deleteMany({ where: { userId: id } }),
    db.taskLog.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ])

  return Response.json({ ok: true })
}
