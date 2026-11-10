import { db } from '@/lib/db'
import { getUserFromReq, unauthorized, forbidden } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // ۲۵ مگابایت برای هر فایل
const MAX_FILES = 10

/** انتشار اطلاعیه با پیوست‌های اختیاری — فقط مدیر */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'محتوای ارسالی نامعتبر است' }, { status: 400 })
  }

  const title = String(form.get('title') ?? '').trim()
  const body = String(form.get('body') ?? '').trim()
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)

  if (!title) {
    return Response.json({ error: 'عنوان اطلاعیه الزامی است' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `حداکثر ${MAX_FILES} فایل در هر اطلاعیه` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return Response.json({ error: `فایل «${f.name}» بزرگ‌تر از ۲۵ مگابایت است` }, { status: 400 })
    }
  }

  const post = await db.sharedPost.create({
    data: {
      title,
      body,
      attachments: {
        create: await Promise.all(
          files.map(async (f) => ({
            fileName: f.name || 'فایل',
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
            data: Buffer.from(await f.arrayBuffer()),
          }))
        ),
      },
    },
    include: { attachments: { select: { id: true, fileName: true, mimeType: true, size: true, downloads: true } } },
  })

  return Response.json({ post })
}

/** حذف اطلاعیه (پیوست‌ها با آن حذف می‌شوند) — فقط مدیر */
export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return unauthorized()
  if (user.role !== 'MANAGER') return forbidden()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'شناسه اطلاعیه الزامی است' }, { status: 400 })

  const existing = await db.sharedPost.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'اطلاعیه یافت نشد' }, { status: 404 })

  await db.sharedPost.delete({ where: { id } })
  return Response.json({ ok: true })
}
