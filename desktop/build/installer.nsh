// ─────────────────────────────────────────────────────────────
// اسپاد مبتکران پیشه — قوانین فایروال ویندوز (NSIS include)
// تا سیستم‌های نیروها در شبکه محلی کارگاه بتوانند به سرور روی
// سیستم دفتر (همین برنامه) وصل شوند، هنگام نصب یک قانون ورودی
// TCP برای فایل اجرایی برنامه اضافه می‌شود و هنگام حذف، پاک می‌شود.
// ─────────────────────────────────────────────────────────────

!macro customInstall
  ; قانون ورودی TCP برای سرور برنامه روی شبکه محلی
  nsExec::Exec 'netsh advfirewall firewall add rule name="Espad Mobtakeran Pishe (TCP-In)" dir=in action=allow program="$INSTDIR\Espad.exe" enable=yes profile=any protocol=tcp'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Espad Mobtakeran Pishe (TCP-In)"'
!macroend
