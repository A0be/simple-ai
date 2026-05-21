@echo off
chcp 65001 >nul
setlocal

REM Build the simple-ai local companion (Windows .exe)
REM Requires: rustup + cargo on PATH.

cd /d "%~dp0companion" || (
  echo X companion 目录不存在
  exit /b 1
)

echo === 编译 simple-ai-companion (release) ===
cargo build --release || (
  echo X 编译失败
  exit /b 1
)

set OUT=target\release\simple-ai-companion.exe
if not exist "%OUT%" (
  echo X 找不到 %OUT%
  exit /b 1
)

echo.
echo √ 完成：%CD%\%OUT%
echo   把这个 exe 给 web 端用户，他们双击运行后就能在网页里读写本机文件 / 跑命令。
echo.
endlocal
