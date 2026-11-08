'use client'

import { useEffect, useState } from 'react'
import { AuthView } from '@/components/app/auth-view'
import { WorkerView } from '@/components/app/worker-view'
import { AdminView } from '@/components/app/admin-view'
import { SplashScreen } from '@/components/app/ui-bits'
import { getSession } from '@/lib/api'
import type { SessionUser } from '@/lib/types'

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let alive = true
    // خواندن نشست ذخیره‌شده به‌صورت غیرهم‌زمان (جلوگیری از رندر آبشاری)
    Promise.resolve().then(() => {
      if (!alive) return
      setUser(getSession())
      setBooting(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (booting) return <SplashScreen />

  if (!user) return <AuthView onLogin={setUser} />

  return user.role === 'MANAGER' ? (
    <AdminView user={user} onLogout={() => setUser(null)} />
  ) : (
    <WorkerView user={user} onLogout={() => setUser(null)} />
  )
}
