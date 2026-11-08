'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AppLogo } from '@/components/app/ui-bits'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { apiPost, setSession } from '@/lib/api'
import type { SessionUser } from '@/lib/types'
import {
  Users,
  Clock,
  Cog,
  Banknote,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  UserPlus,
  Sparkles,
  Loader2,
  ShieldCheck,
  Phone,
} from 'lucide-react'

/** تبدیل ارقام فارسی/عربی به لاتین */
function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

const FEATURES = [
  { icon: Users, title: 'ثبت‌نام نیروها', desc: 'هر نیرو با موبایل خودش عضو می‌شود' },
  { icon: Clock, title: 'حضور و غیاب لحظه‌ای', desc: 'ورود و خروج با یک لمس، بدون ورق و دفتر' },
  { icon: Cog, title: 'تایم ماشین‌کاری CNC', desc: 'ثبت دستگاه، قطعه، جنس و مدت‌زمان کار' },
  { icon: Banknote, title: 'درخواست مساعده آنلاین', desc: 'ثبت درخواست و پیگیری تایید توسط مدیر' },
  { icon: ClipboardCheck, title: 'چک‌لیست کار روزانه', desc: 'گزارش کارها در دسته‌بندی‌های شغلی' },
  { icon: LayoutDashboard, title: 'بانک اطلاعات مدیریت', desc: 'مدیر بدون جمع‌کردن دستی، همه‌چیز را زنده می‌بیند' },
]

export function AuthView({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regJob, setRegJob] = useState('')
  const [regPass, setRegPass] = useState('')
  const [loadingReg, setLoadingReg] = useState(false)
  const [demoLoading, setDemoLoading] = useState<'manager' | 'worker' | null>(null)

  async function doLogin(phone: string, password: string) {
    const res = await apiPost<{ user: SessionUser }>('/api/auth/login', { phone, password })
    setSession(res.user)
    onLogin(res.user)
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginPhone.trim() || !loginPass) {
      toast.error('شماره موبایل و رمز عبور را وارد کنید')
      return
    }
    setLoadingLogin(true)
    try {
      await doLogin(normalizeDigits(loginPhone.trim()), loginPass)
      toast.success('خوش آمدید! 👋')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ورود')
    } finally {
      setLoadingLogin(false)
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!regName.trim() || !regPhone.trim() || !regPass) {
      toast.error('نام، شماره موبایل و رمز عبور الزامی است')
      return
    }
    setLoadingReg(true)
    try {
      const res = await apiPost<{ user: SessionUser }>('/api/auth/register', {
        name: regName.trim(),
        phone: normalizeDigits(regPhone.trim()),
        password: regPass,
        jobTitle: regJob.trim(),
      })
      setSession(res.user)
      onLogin(res.user)
      toast.success('ثبت‌نام موفق بود؛ به تیم خوش آمدید! 🎉')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت‌نام')
    } finally {
      setLoadingReg(false)
    }
  }

  async function demoLogin(role: 'manager' | 'worker') {
    setDemoLoading(role)
    try {
      await doLogin(role === 'manager' ? '09120000000' : '09121111111', 'demo1234')
      toast.success(role === 'manager' ? 'به پنل مدیریت خوش آمدید' : 'به داشبورد نیرو خوش آمدید')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ورود دمو')
    } finally {
      setDemoLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col workshop-bg">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* ── معرفی محصول ── */}
          <section className="order-2 lg:order-1 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <AppLogo size="lg" />
                <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-relaxed">
                  دفتر مدیریت کارگاه،
                  <br />
                  <span className="text-amber-600 dark:text-amber-400">در جیب هر نیرو</span>
                </h1>
              </div>
              <div className="pt-1 flex flex-col items-center gap-1.5">
                <ThemeToggle />
                <span className="text-[10px] text-muted-foreground">تم نمایش</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-7 max-w-md">
                نیروها گزارش کار، حضور و غیاب و درخواست‌هایشان را داخل اپ ثبت می‌کنند؛ شما در دفتر مدیریت،
                <span className="font-semibold text-foreground"> بدون جمع‌کردن دونه‌دونه گزارش‌ها</span>، به بانک اطلاعات کامل کارگاه دسترسی زنده دارید.
              </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-3 p-3 rounded-xl bg-card/70 backdrop-blur border border-border shadow-sm">
                  <div className="size-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <f.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{f.title}</div>
                    <div className="text-xs text-muted-foreground leading-5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── کارت ورود ── */}
          <section className="order-1 lg:order-2">
            <Card className="shadow-xl border-border/70 bg-card/95 backdrop-blur">
              <CardContent className="p-6 sm:p-8">
                <Tabs defaultValue="login" dir="rtl">
                  <TabsList className="grid grid-cols-2 w-full h-10 mb-6">
                    <TabsTrigger value="login" className="gap-1.5">
                      <LogIn className="size-4" /> ورود
                    </TabsTrigger>
                    <TabsTrigger value="register" className="gap-1.5">
                      <UserPlus className="size-4" /> ثبت‌نام نیرو
                    </TabsTrigger>
                  </TabsList>

                  {/* ورود */}
                  <TabsContent value="login">
                    <form onSubmit={submitLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-phone">شماره موبایل</Label>
                        <div className="relative">
                          <Phone className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="login-phone"
                            inputMode="numeric"
                            placeholder="09xxxxxxxxx"
                            className="pr-9 text-left"
                            dir="ltr"
                            value={loginPhone}
                            onChange={(e) => setLoginPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-pass">رمز عبور</Label>
                        <Input
                          id="login-pass"
                          type="password"
                          placeholder="••••••••"
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 text-base font-bold" disabled={loadingLogin}>
                        {loadingLogin ? <Loader2 className="size-5 animate-spin" /> : 'ورود به کارگاه‌یار'}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ثبت‌نام */}
                  <TabsContent value="register">
                    <form onSubmit={submitRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">نام و نام خانوادگی</Label>
                        <Input id="reg-name" placeholder="مثلاً: علی محمدی" value={regName} onChange={(e) => setRegName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="reg-phone">شماره موبایل</Label>
                          <Input
                            id="reg-phone"
                            inputMode="numeric"
                            placeholder="09xxxxxxxxx"
                            dir="ltr"
                            className="text-left"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reg-job">سمت شغلی</Label>
                          <Input id="reg-job" placeholder="اپراتور CNC" value={regJob} onChange={(e) => setRegJob(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-pass">رمز عبور</Label>
                        <Input id="reg-pass" type="password" placeholder="حداقل ۶ کاراکتر" value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                      </div>
                      <Button type="submit" className="w-full h-11 text-base font-bold" disabled={loadingReg}>
                        {loadingReg ? <Loader2 className="size-5 animate-spin" /> : 'ثبت‌نام و ورود'}
                      </Button>
                      <p className="text-[11px] text-muted-foreground leading-5 text-center">
                        با ثبت‌نام، اطلاعات کاری شما برای مدیریت کارگاه در دسترس قرار می‌گیرد.
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="my-5 flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3.5 text-amber-500" /> ورود دموی یک‌کلیکی
                  </span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-11 border-stone-300 dark:border-stone-600 dim:border-stone-600 hover:bg-accent"
                    disabled={demoLoading !== null}
                    onClick={() => demoLogin('manager')}
                  >
                    {demoLoading === 'manager' ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4 text-stone-600" />}
                    پنل مدیریت
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 border-amber-300 dark:border-amber-700 dim:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 dim:hover:bg-amber-950/40"
                    disabled={demoLoading !== null}
                    onClick={() => demoLogin('worker')}
                  >
                    {demoLoading === 'worker' ? <Loader2 className="size-4 animate-spin" /> : <Cog className="size-4 text-amber-600" />}
                    داشبورد نیرو
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  حساب دمو: مدیر <b dir="ltr">09120000000</b> · نیرو <b dir="ltr">09121111111</b> · رمز <b dir="ltr">demo1234</b>
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="mt-auto py-4 text-center text-xs text-muted-foreground">
        کارگاه‌یار — نسخه دمو · ساخته‌شده برای مدیریت هوشمند کارگاه
      </footer>
    </div>
  )
}
