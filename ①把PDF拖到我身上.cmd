@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo   用法：把一个或多个 PDF 文件拖到这个图标上，松手即可。
  echo   脚本会自动归档到「售后资料」文件夹、更新文件清单并上传到 GitHub。
  echo.
  pause
  exit /b 1
)

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

%PY% "维护脚本\添加文件.py" %* --push
echo.
pause
