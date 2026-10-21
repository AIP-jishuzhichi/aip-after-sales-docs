@echo off
setlocal
cd /d "%~dp0"

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

%PY% "维护脚本\上传.py"
echo.
pause
