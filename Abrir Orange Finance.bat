@echo off
setlocal
cd /d "%~dp0"
title Orange Finance

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install || goto :error
)

echo Preparando o Orange Finance...
call npm run build || goto :error

start "Orange Finance - servidor local" /min cmd /c "npx vite preview"

rem Wait until the local server answers (up to ~30 s) before opening the window.
set /a tries=0
:wait
curl -s -o nul http://localhost:5180/ && goto :open
set /a tries+=1
if %tries% geq 30 goto :error
ping -n 2 127.0.0.1 >nul
goto :wait

:open
start "" msedge --app=http://localhost:5180/
exit /b 0

:error
echo.
echo Nao foi possivel iniciar o Orange Finance. Veja a mensagem acima.
pause
exit /b 1
