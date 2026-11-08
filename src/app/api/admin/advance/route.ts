import { db } from '@/lib/db'
import { getUserFromReq, unauthorized, forbidden } from '@/lib/server-auth'

/** بررسی درخواست مساعده (تایید / رد) توسط مدیر */
export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const body = await req.json().catch(() => ({}))
  const { id, status, reviewNote } = body ?? {}

  if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
    return Response.json({ error: 'پارامترهای بررسی نامعتبر است' }, { status: 400 })
  }

  const existing = await db.advanceRequest.findUnique({ where: { id } })
  if (!existing) {
    return Response.json({ error: 'درخواست یافت نشد' }, { status: 404 })
  }
  if (existing.status !== 'PENDING') {
    return Response.json({ error: 'این درخواست قبلاً بررسی شده است' }, { status: 409 })
  }

  const rec = await db.advanceRequest.update({
    where: { id },
    data: {
      status,
      reviewNote: reviewNote?.trim() || null,
      reviewedAt: new Date(),
    },
  })

  return Response.json({
    advance: {
      ...rec,
      createdAt: rec.createdAt.toISOString(),
      reviewedAt: rec.reviewedAt?.toISOString() ?? null,
    },
  })
}
