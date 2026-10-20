@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

echo.
echo   正在检查「售后资料」文件夹的变化 …
echo.

%PY% "维护脚本\生成清单.py"

git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo.
  echo   没有检测到任何变化，可能你还没有删除文件。
  echo.
  pause
  exit /b 0
)

git commit -m "docs: 删除不用的文件"
git push
echo.
echo   完成！网页大约 1 分钟后同步。
echo.
pause
