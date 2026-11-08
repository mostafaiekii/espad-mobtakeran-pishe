# ساخت کامل نسخه ویندوز کارگاه‌یار — روی لینوکس/مک اجرا می‌شود (کراس‌کامپایل NSIS)
# پیش‌نیاز: bun + npm
set -e

STAGE=${STAGE:-/tmp/kargahyar-stage}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

echo "── 1) کپی پروژه به دایرکتوری بیلد: $STAGE"
rm -rf "$STAGE" && mkdir -p "$STAGE/db"
for item in src prisma public scripts package.json tsconfig.json next.config.ts components.json tailwind.config.ts bun.lock postcss.config.mjs eslint.config.mjs; do
  [ -e "$ROOT/$item" ] && cp -r "$ROOT/$item" "$STAGE/"
done

cd "$STAGE"
echo "── 2) نصب وابستگی‌ها"
bun install

echo "── 3) دیتابیس دمو"
export DATABASE_URL="file:$STAGE/db/demo.db"
bunx prisma db push --accept-data-loss
bun prisma/seed.ts

echo "── 4) بیلد Next.js standalone"
bun run build

echo "── 5) مونتاژ منابع Electron"
mkdir -p "$ROOT/desktop/resources/seed"
rm -rf "$ROOT/desktop/resources/app"
cp -r .next/standalone "$ROOT/desktop/resources/app"
cp -r .next/static "$ROOT/desktop/resources/app/.next/static"
cp -r public "$ROOT/desktop/resources/app/public"
# موتور Prisma ویندوز + اسکیما باید کنار کلاینت تولیدشده باشند
cp "$STAGE/node_modules/.prisma/client/"*windows* "$ROOT/desktop/resources/app/node_modules/.prisma/client/" 2>/dev/null || true
cp "$STAGE/node_modules/.prisma/client/schema.prisma" "$ROOT/desktop/resources/app/node_modules/.prisma/client/" 2>/dev/null || true
cp db/demo.db "$ROOT/desktop/resources/seed/kargahyar.db"

echo "── 6) نصب Electron"
cd "$ROOT/desktop"
npm install --no-audit --no-fund

echo "── 7) خروجی NSIS ویندوز"
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis --x64

echo "✔ خروجی: $ROOT/desktop/dist/Kargahyar-Setup-1.0.0.exe"
