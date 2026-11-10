import { NextResponse } from 'next/server'
import os from 'os'

export const dynamic = 'force-dynamic'

/**
 * آدرس‌های شبکه‌ای سرور برای اتصال سیستم‌های نیروها (LAN)
 * مدیر این آدرس‌ها را در پنل «راهنمای اتصال» می‌بیند و
 * نیروها همان آدرس را در مرورگر سیستم خودشان باز می‌کنند.
 */
export function GET() {
  const nets = os.networkInterfaces()
  const ips: string[] = []
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      // فقط IPv4های واقعی شبکه (بدون loopback و آدرس‌های رزرو)
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) {
        if (!ips.includes(a.address)) ips.push(a.address)
      }
    }
  }
  const port = Number(process.env.PORT || 3000)
  return NextResponse.json({
    ips,
    port,
    urls: ips.map((ip) => `http://${ip}:${port}`),
  })
}
