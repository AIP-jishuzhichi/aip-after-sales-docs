@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY=python"
where py >nul 2>nul && set "PY=py -3"

echo Starting local preview at http://localhost:8123 ...
start "" http://localhost:8123/
%PY% -m http.server 8123
