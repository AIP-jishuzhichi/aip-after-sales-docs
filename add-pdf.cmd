@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo   Drag one or more PDF files onto this file, then release.
  echo   The script will copy them into files\ , rebuild the index and push.
  echo.
  pause
  exit /b 1
)

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

%PY% scripts\add_pdf.py %* --push
echo.
pause
