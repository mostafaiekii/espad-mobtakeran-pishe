import { db } from '@/lib/db'

/**
 * بازنشانی حساب مدیر — فقط از خودِ سیستمِ سرور (پنجرهٔ برنامهٔ ویندوزی)
 * ─────────────────────────────────────────────────────────────
 * این مسیر برای بازیابی وقتی مدیر رمز عبورش را فراموش کرده یا باید تعویض شود،
 * توسط پوستهٔ Electron (که روی سیستم دفتر اجرا می‌شود) صدا زده می‌شود.
 *
 * امنیت:
 * • تنها با هدر «x-local-secret» که مقدارش با SPAD_LOCAL_SECRET (متغیر محیطی
 *   که فقط پروسهٔ Electron به موتور می‌دهد) برابر است مجاز است.
 * • نیروها و مرورگرهای داخل شبکه این رمز را ندارند و نمی‌توانند مدیر را حذف کنند.
 * • اگر SPAD_LOCAL_SECRET تعریف نشده باشد، مسیر کاملاً غیرفعال است.
 *
 * اثر: حساب(های) مدیر حذف می‌شود تا صفحهٔ «راه‌اندازی اولیه» دوباره باز شود و
 * مدیر جدید ثبت‌نام کند. حساب نیروها و تمام داده‌های کاری دست‌نخورده می‌ماند.
 */
export async function POST(req: Request) {
  const expected = process.env.SPAD_LOCAL_SECRET
  if (!expected) {
    return Response.json({ error: 'این قابلیت فقط داخل برنامهٔ دسکتاپ فعال است' }, { status: 404 })
  }
  if (req.headers.get('x-local-secret') !== expected) {
    return Response.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }

  try {
    const managers = await db.user.findMany({
      where: { role: 'MANAGER' },
      select: { id: true },
    })
    if (managers.length === 0) {
      return Response.json({ ok: true, deleted: 0, message: 'مدیری وجود ندارد' })
    }

    const ids = managers.map((m) => m.id)

    // رکوردهای وابستهٔ مدیر (کلیدهای خارجی RESTRICT هستند — مدیر عادی رکورد کاری ندارد، برای اطمینان پاک می‌شود)
    await db.attendance.deleteMany({ where: { userId: { in: ids } } })
    await db.cncJob.deleteMany({ where: { userId: { in: ids } } })
    await db.advanceRequest.deleteMany({ where: { userId: { in: ids } } })
    await db.taskLog.deleteMany({ where: { userId: { in: ids } } })
    await db.presence.deleteMany({ where: { userId: { in: ids } } })

    const res = await db.user.deleteMany({ where: { id: { in: ids } } })
    console.log(`[reset-manager] ${res.count} حساب مدیر حذف شد — راه‌اندازی اولیه آزاد شد`)
    return Response.json({ ok: true, deleted: res.count })
  } catch {
    return Response.json({ error: 'خطای سرور در بازنشانی حساب مدیر' }, { status: 500 })
  }
}
