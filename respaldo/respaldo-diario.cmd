@echo off
REM Respaldo diario de Morcast. Lo dispara el Programador de tareas de Windows.
REM Los lunes ademas corre la prueba de restauracion.

setlocal
cd /d "%~dp0.."

set "REG=%~dp0..\..\Respaldos Morcast\bitacora-respaldos.txt"

echo. >> "%REG%"
echo ===== %DATE% %TIME% ===== >> "%REG%"
node "respaldo\respaldar.mjs" >> "%REG%" 2>&1
set RESULTADO=%ERRORLEVEL%

if %RESULTADO% NEQ 0 (
  echo *** EL RESPALDO FALLO ^(codigo %RESULTADO%^) *** >> "%REG%"
  exit /b %RESULTADO%
)

REM Un respaldo que nunca se restaura no es un respaldo. Se comprueba
REM una vez por semana, no todos los dias, porque tarda.
for /f "tokens=*" %%d in ('powershell -NoProfile -Command "(Get-Date).DayOfWeek"') do set DIA=%%d
if /i "%DIA%"=="Monday" (
  echo --- prueba de restauracion semanal --- >> "%REG%"
  node "respaldo\probar-restauracion.mjs" >> "%REG%" 2>&1
  if errorlevel 1 echo *** LA PRUEBA DE RESTAURACION NO CUADRO *** >> "%REG%"
)

exit /b 0
