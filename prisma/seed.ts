/**
 * Seed دموی «کارگاه‌یار» — داده‌های نمونه برای نمایش اپ
 * اجرا: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const MACHINES = ['CNC فرز ۱', 'CNC فرز ۲', 'CNC تراش ۱', 'CNC تراش ۲', 'وایرکات']
const MATERIALS = ['آلومینیوم', 'فولاد ST37', 'استیل ۳۰۴', 'برنج', 'چدن']
const PARTS = ['فلنج ۶ اینچ', 'بوش متنوع', 'شفت محور', 'پولی تایمینگ', 'نمونه ذوزنقه', 'گیج کنترلی', 'هاوسینگ بلبرینگ', 'ورق کرم‌کاری']
const TASKS: { title: string; category: string }[] = [
  { title: 'روغن‌کاری و سرویس روزانه دستگاه', category: 'MAINTENANCE' },
  { title: 'کنترل ابعادی قطعات با کولیس', category: 'QUALITY' },
  { title: 'آماده‌سازی مواد اولیه برای شیفت فردا', category: 'GENERAL' },
  { title: 'بسته‌بندی سفارش پالایشگاه', category: 'PACKAGING' },
  { title: 'بررسی ایمنی و شل بودن گیره‌ها', category: 'SAFETY' },
  { title: 'تعویض تیغه فرز و تنظیم لقی', category: 'MAINTENANCE' },
]

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)]
}

async function main() {
  await db.attendance.deleteMany()
  await db.cncJob.deleteMany()
  await db.advanceRequest.deleteMany()
  await db.taskLog.deleteMany()
  await db.user.deleteMany()

  const pass = 'demo1234'

  const manager = await db.user.create({
    data: { name: 'مهدی رضایی', phone: '09120000000', password: pass, role: 'MANAGER', jobTitle: 'مدیر کارگاه' },
  })

  const workersData = [
    { name: 'علی محمدی', phone: '09121111111', jobTitle: 'اپراتور CNC فرز', hourlyRate: 180000 },
    { name: 'رضا کریمی', phone: '09122222222', jobTitle: 'اپراتور CNC تراش', hourlyRate: 165000 },
    { name: 'حسن احمدی', phone: '09123333333', jobTitle: 'جوشکار و مونتاژکار', hourlyRate: 150000 },
    { name: 'سمیرا حسینی', phone: '09124444444', jobTitle: 'کنترل کیفیت', hourlyRate: 170000 },
  ]

  const workers = [] as { id: string }[]
  for (const w of workersData) {
    workers.push(await db.user.create({ data: { ...w, password: pass, role: 'WORKER' } }))
  }

  // ── حضور و غیاب ۷ روز اخیر ──
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let d = 7; d >= 0; d--) {
    for (const w of workers) {
      if (d > 0 && Math.random() < 0.15) continue // بعضی روزها غیبت
      const day = new Date(today)
      day.setDate(day.getDate() - d)
      const entry = new Date(day)
      entry.setHours(rand(7, 9), rand(0, 59), 0, 0)
      await db.attendance.create({
        data: { userId: w.id, type: 'ENTRY', timestamp: entry, note: d === 0 ? undefined : undefined },
      })
      const exit = new Date(entry)
      exit.setHours(rand(16, 19), rand(0, 59))
      if (d === 0 && Math.random() < 0.5) continue // امروز بعضی‌ها هنوز سر کارن
      await db.attendance.create({ data: { userId: w.id, type: 'EXIT', timestamp: exit } })
    }
  }

  // ── jobs ماشینکاری CNC ──
  for (let d = 6; d >= 0; d--) {
    for (const w of workers.slice(0, 2)) {
      const count = rand(0, 2)
      for (let i = 0; i < count; i++) {
        const day = new Date(today)
        day.setDate(day.getDate() - d)
        const start = new Date(day)
        start.setHours(rand(8, 14), rand(0, 59), 0, 0)
        const dur = rand(45, 320)
        const end = new Date(start.getTime() + dur * 60000)
        await db.cncJob.create({
          data: {
            userId: w.id,
            machine: pick(MACHINES),
            partName: pick(PARTS),
            material: pick(MATERIALS),
            startTime: start,
            endTime: end,
            durationMin: dur,
            note: Math.random() < 0.3 ? pick(['تیغه نو', 'دوبار تنظیم صفر انجام شد', 'سطح کاری خوب', '']) : undefined,
          },
        })
      }
    }
  }
  // چند job متوقف‌شده برای تنوع
  const runningStart = new Date()
  runningStart.setHours(runningStart.getHours() - 1)
  await db.cncJob.create({
    data: {
      userId: workers[0].id,
      machine: MACHINES[0],
      partName: PARTS[0],
      material: MATERIALS[0],
      startTime: runningStart,
      endTime: new Date(runningStart.getTime() + 95 * 60000),
      durationMin: 95,
      status: 'RUNNING',
    },
  })

  // ── درخواست‌های مساعده ──
  const advances = [
    { userId: workers[0].id, amount: 3000000, reason: 'مصارف خانوادگی و اجاره منزل', status: 'PENDING' },
    { userId: workers[1].id, amount: 5000000, reason: 'تعمیر خودرو برای رفت‌وآمد کارگاه', status: 'PENDING' },
    { userId: workers[2].id, amount: 2000000, reason: 'هزینه درمان دندانپزشکی', status: 'PENDING' },
    { userId: workers[3].id, amount: 4000000, reason: 'خرید لوازم منزل', status: 'APPROVED', reviewNote: 'تایید شد — پرداخت در نوبت آبان', reviewedAt: new Date(Date.now() - 3 * 86400000) },
    { userId: workers[1].id, amount: 6000000, reason: 'مصارف شخصی', status: 'REJECTED', reviewNote: 'مساعده ماه قبل تسویه نشده است', reviewedAt: new Date(Date.now() - 6 * 86400000) },
    { userId: workers[2].id, amount: 2500000, reason: 'سفر خانوادگی', status: 'APPROVED', reviewNote: 'نصف مبلغ این هفته، نصفش با حقوق', reviewedAt: new Date(Date.now() - 10 * 86400000) },
  ]
  for (const a of advances) await db.advanceRequest.create({ data: a })

  // ── چک‌لیست کارها ──
  for (let d = 4; d >= 0; d--) {
    for (const w of workers) {
      const count = rand(1, 3)
      for (let i = 0; i < count; i++) {
        const t = pick(TASKS)
        const day = new Date(today)
        day.setDate(day.getDate() - d)
        day.setHours(rand(9, 16), rand(0, 59))
        await db.taskLog.create({
          data: {
            userId: w.id,
            title: t.title,
            category: t.category,
            date: day,
            status: d === 0 && Math.random() < 0.3 ? 'TODO' : 'DONE',
          },
        })
      }
    }
  }

  console.log('✅ Seed complete:', {
    manager: manager.name,
    workers: workers.length,
    advances: advances.length,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
