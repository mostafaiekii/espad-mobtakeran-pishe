import { db } from '@/lib/db'
import { toSessionUser } from '@/lib/server-auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { phone, password } = body ?? {}

    if (!phone?.trim() || !password) {
      return Response.json({ error: 'شماره موبایل و رمز عبور الزامی است' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { phone: String(phone).trim() } })
    if (!user || user.password !== String(password)) {
      return Response.json({ error: 'شماره موبایل یا رمز عبور اشتباه است' }, { status: 401 })
    }

    return Response.json({ user: toSessionUser(user) })
  } catch {
    return Response.json({ error: 'خطای سرور در ورود' }, { status: 500 })
  }
}
