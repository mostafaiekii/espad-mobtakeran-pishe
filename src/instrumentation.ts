/**
 * Bootstrap دیتابیس در استارت سرور (Next.js instrumentation)
 * ─────────────────────────────────────────────────────────
 * در نصب تازهٔ نسخهٔ دسکتاپ / سرور جدید، فایل SQLite خالی است.
 * این ماژول پیش از اولین درخواست، جداول را با CREATE TABLE IF NOT EXISTS
 * می‌سازد تا برنامه بدون هیچ دادهٔ دمو و بدون دستور دستی، آمادهٔ استفاده باشد.
 * این عملیات idempotent است و روی دیتابیس موجود هیچ تغییری نمی‌دهد.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WORKER',
    "jobTitle" TEXT,
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "CncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "material" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "AdvanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "TaskLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    await db.$queryRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`
    )
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "SharedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "PostAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "data" BLOB NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PostAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SharedPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`)
    await db.$queryRawUnsafe(`CREATE TABLE IF NOT EXISTS "Presence" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "view" TEXT NOT NULL DEFAULT 'attendance',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`)

    // پاکسازی حساب‌های دموی نسخه‌های قدیمی تا فرم راه‌اندازی اولیه (ساخت مدیر واقعی) آزاد شود
    const { cleanupLegacyDemoData } = await import('@/lib/legacy-cleanup')
    await cleanupLegacyDemoData()

    console.log('[db-init] schema ready')
  } catch (e) {
    console.error('[db-init] failed:', e)
  }
}
