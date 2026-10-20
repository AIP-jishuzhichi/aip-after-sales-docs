@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

echo.
echo   正在启动本地预览：http://localhost:8123
echo   浏览结束后，关掉这个黑色窗口即可停止。
echo.
start "" http://localhost:8123/
%PY% -m http.server 8123
