import { db } from '@/lib/db'
import { toSessionUser } from '@/lib/server-auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, password, jobTitle, hourlyRate } = body ?? {}

    if (!name?.trim() || !phone?.trim() || !password) {
      return Response.json({ error: 'نام، شماره موبایل و رمز عبور الزامی است' }, { status: 400 })
    }
    if (!/^09\d{9}$/.test(String(phone).trim())) {
      return Response.json({ error: 'شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return Response.json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, { status: 400 })
    }

    const exists = await db.user.findUnique({ where: { phone: String(phone).trim() } })
    if (exists) {
      return Response.json({ error: 'این شماره موبایل قبلاً ثبت‌نام کرده است' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        password: String(password),
        role: 'WORKER', // ثبت‌نام عمومی فقط به‌عنوان نیرو؛ مدیر توسط سیستم تعریف می‌شود
        jobTitle: jobTitle?.trim() || null,
        hourlyRate: Number(hourlyRate) || 0,
      },
    })

    return Response.json({ user: toSessionUser(user) })
  } catch {
    return Response.json({ error: 'خطای سرور در ثبت‌نام' }, { status: 500 })
  }
}
