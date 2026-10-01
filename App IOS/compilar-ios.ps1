# Compila la app de iPhone en EAS.  Uso:  .\compilar-ios.ps1
#
# POR QUÉ NO BASTA CON `eas build`: con git, EAS sube el repositorio entero y
# en su servidor la app queda en ".../build/App IOS/". El script de
# expo-constants arma esa ruta sin comillas y se rompe en el espacio:
#   bash: /Users/expo/workingdir/build/App: No such file or directory
# (build fallido del 1-oct-2026). Aquí se sube SOLO esta carpeta como raíz del
# proyecto, y la ruta en el servidor queda sin espacios.
#
# Lo que se sube lo decide `.easignore` de esta carpeta (que SÍ incluye el
# `.env` con las llaves de Supabase). Para revisarlo sin compilar:
#   $env:EAS_NO_VCS=1; $env:EAS_PROJECT_ROOT=$PSScriptRoot
#   eas build:inspect -p ios --profile production --stage archive --output ..\revisar

param([string]$Perfil = "production")

$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
try {
  Set-Location $PSScriptRoot
  eas build --platform ios --profile $Perfil
} finally {
  Remove-Item Env:EAS_NO_VCS, Env:EAS_PROJECT_ROOT -ErrorAction SilentlyContinue
}
