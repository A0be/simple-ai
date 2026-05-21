@echo off
title Build Electron .exe - 简易 AI 工具箱
chcp 65001 >nul 2>nul

echo.
echo ====================================================
echo   简易 AI 工具箱 - Electron 打包（内嵌 Chrome 内核）
echo ====================================================
echo.

cd /d "%~dp0"

REM ============ Check Node.js ============
echo [1/4] 检查 Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo   X 未找到 Node.js，请先安装: https://nodejs.org
  pause
  exit /b 1
)
node --version
echo.

REM ============ Install dependencies ============
echo [2/4] 检查依赖 ...
if not exist "node_modules\electron\dist\electron.exe" (
  echo   安装依赖中（首次需要 2-5 分钟）...
  call npm install
  if errorlevel 1 (
    echo   X npm install 失败，检查网络后重试
    pause
    exit /b 1
  )
)
echo   OK
echo.

REM ============ Build frontend ============
echo [3/4] 构建前端（Vite）...
set ELECTRON=1
call npx vite build
if errorlevel 1 (
  echo   X 前端构建失败
  pause
  exit /b 1
)
echo.

REM ============ Package Electron ============
echo [4/4] 打包 Electron exe（首次需要下载 Electron 二进制，约 80MB）...
call npx electron-builder --win
if errorlevel 1 (
  echo   X Electron 打包失败
  pause
  exit /b 1
)

echo.
echo ====================================================
echo   打包成功！
echo ====================================================
echo.
echo   输出目录: %CD%\release\
echo.
echo   安装包在 release\ 文件夹中。
echo.

if exist "release" (
  start "" "release"
)
pause
exit /b 0
