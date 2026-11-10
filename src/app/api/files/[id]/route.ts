import { db } from '@/lib/db'
import { getUserFromReq, unauthorized } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * دانلود فایل پیوست اطلاعیه — برای همه کاربران واردشده (مدیر و نیرو)
 * هر دانلود شمارنده‌ی «downloads» را بالا می‌برد تا مدیر بفهمد چه کسانی فایل را گرفته‌اند.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()

  const { id } = await params
  const att = await db.postAttachment.findUnique({ where: { id } })
  if (!att) {
    return Response.json({ error: 'فایل یافت نشد' }, { status: 404 })
  }

  await db.postAttachment.update({ where: { id }, data: { downloads: { increment: 1 } } })

  const bytes = new Uint8Array(att.data)
  const safeName = att.fileName.replace(/[\\/:*?"<>|\r\n]/g, '_')

  return new Response(bytes, {
    headers: {
      'Content-Type': att.mimeType || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="spad-file"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Cache-Control': 'no-store',
    },
  })
}
