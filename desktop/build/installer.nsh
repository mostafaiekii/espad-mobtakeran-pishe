# Spad Mobtakeran Pishe - Windows firewall rules (NSIS include)
# Adds an inbound TCP rule for the app executable at install time so that
# worker PCs in the workshop LAN can reach the local server, and removes
# the rule at uninstall time. NOTE: NSIS comments use ';' or '#'.

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall add rule name="Spad Mobtakeran Pishe (TCP-In)" dir=in action=allow program="$INSTDIR\Spad.exe" enable=yes profile=any protocol=tcp'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Spad Mobtakeran Pishe (TCP-In)"'
!macroend
