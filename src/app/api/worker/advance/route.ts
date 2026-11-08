import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

/** ثبت درخواست مساعده */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { amount, reason } = body ?? {}

  const amt = Number(amount)
  if (!amt || amt < 100000) {
    return Response.json({ error: 'مبلغ مساعده حداقل ۱۰۰,۰۰۰ تومان است' }, { status: 400 })
  }
  if (amt > 50000000) {
    return Response.json({ error: 'سقف مساعده ۵۰,۰۰۰,۰۰۰ تومان است' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return Response.json({ error: 'دلیل درخواست را وارد کنید' }, { status: 400 })
  }

  const openPending = await db.advanceRequest.findFirst({
    where: { userId: user.id, status: 'PENDING' },
  })
  if (openPending) {
    return Response.json({ error: 'شما یک درخواست در انتظار بررسی دارید' }, { status: 409 })
  }

  const rec = await db.advanceRequest.create({
    data: { userId: user.id, amount: Math.round(amt), reason: String(reason).trim() },
  })

  return Response.json({
    advance: {
      ...rec,
      createdAt: rec.createdAt.toISOString(),
      reviewedAt: rec.reviewedAt?.toISOString() ?? null,
    },
  })
}

/** لغو درخواست مساعده در انتظار (توسط خود نیرو) */
export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'شناسه درخواست الزامی است' }, { status: 400 })

  const existing = await db.advanceRequest.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'درخواست یافت نشد' }, { status: 404 })
  if (existing.userId !== user.id) return Response.json({ error: 'اجازه لغو این درخواست را ندارید' }, { status: 403 })
  if (existing.status !== 'PENDING') {
    return Response.json({ error: 'فقط درخواست‌های در انتظار قابل لغو هستند' }, { status: 409 })
  }

  await db.advanceRequest.delete({ where: { id } })
  return Response.json({ ok: true })
}
