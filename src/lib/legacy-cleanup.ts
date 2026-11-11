import { db } from '@/lib/db'

/**
 * پاکسازی حساب‌های دموی نسخه‌های قدیمی (کارگاه‌یار / اسپاد ≤ ۱.۲)
 * ─────────────────────────────────────────────────────────────
 * نسخه‌های اول با دیتابیس دمو عرضه می‌شدند: یک مدیر دمو (۰۹۱۲۰۰۰۰۰۰۰)
 * و چهار نیروی دمو. اگر کاربر از آن نسخه‌ها ارتقا داده باشد، این حساب‌ها
 * در دیتابیس او مانده‌اند و چون «مدیری وجود دارد»، فرم راه‌اندازی اولیه
 * (ساخت حساب مدیر واقعی) دیگر نمایش داده نمی‌شود.
 *
 * این مهاجرت idempotent است: در هر استارت فقط حساب‌هایی که دقیقاً با این
 * شماره‌های دمو ثبت شده‌اند را — به‌همراه رکوردهایشان — پاک می‌کند و
 * به داده‌های واقعی کاربر هیچ دستی نمی‌زند.
 */
const DEMO_PHONES = ['09120000000', '09121111111', '09122222222', '09123333333', '09124444444']

export async function cleanupLegacyDemoData(): Promise<number> {
  const demo = await db.user.findMany({
    where: { phone: { in: DEMO_PHONES } },
    select: { id: true },
  })
  if (demo.length === 0) return 0

  const ids = demo.map((u) => u.id)

  // اول رکوردهای وابسته (کلیدهای خارجی از نوع RESTRICT هستند)
  await db.attendance.deleteMany({ where: { userId: { in: ids } } })
  await db.cncJob.deleteMany({ where: { userId: { in: ids } } })
  await db.advanceRequest.deleteMany({ where: { userId: { in: ids } } })
  await db.taskLog.deleteMany({ where: { userId: { in: ids } } })
  await db.presence.deleteMany({ where: { userId: { in: ids } } })

  const res = await db.user.deleteMany({ where: { id: { in: ids } } })
  console.log(`[db-init] ${res.count} حساب دموی نسخه‌های قدیمی پاک شد — راه‌اندازی اولیه آزاد شد`)
  return res.count
}
