import { db } from '@/lib/db'
import { toSessionUser } from '@/lib/server-auth'

/**
 * راه‌اندازی اولیه — ثبت‌نام اولین مدیر کارگاه
 * GET  → آیا راه‌اندازی لازم است؟ (هیچ مدیری وجود ندارد)
 * POST → ساخت اولین مدیر (فقط وقتی هیچ مدیری وجود نداشته باشد)
 */
export async function GET() {
  try {
    const managers = await db.user.count({ where: { role: 'MANAGER' } })
    return Response.json({ needed: managers === 0 })
  } catch {
    return Response.json({ needed: false })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, password } = body ?? {}

    if (!name?.trim() || !phone?.trim() || !password) {
      return Response.json({ error: 'نام، شماره موبایل و رمز عبور الزامی است' }, { status: 400 })
    }
    if (!/^09\d{9}$/.test(String(phone).trim())) {
      return Response.json({ error: 'شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return Response.json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, { status: 400 })
    }

    const managers = await db.user.count({ where: { role: 'MANAGER' } })
    if (managers > 0) {
      return Response.json({ error: 'مدیر کارگاه قبلاً تعریف شده است؛ وارد شوید' }, { status: 409 })
    }

    const exists = await db.user.findUnique({ where: { phone: String(phone).trim() } })
    if (exists) {
      return Response.json({ error: 'این شماره موبایل قبلاً ثبت شده است' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        password: String(password),
        role: 'MANAGER',
        jobTitle: 'مدیر کارگاه',
        hourlyRate: 0,
      },
    })

    return Response.json({ user: toSessionUser(user) })
  } catch {
    return Response.json({ error: 'خطای سرور در راه‌اندازی' }, { status: 500 })
  }
}
