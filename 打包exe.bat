@echo off
title Build Windows .exe - Simple AI Toolbox

echo.
echo ====================================================
echo  Simple AI Toolbox - Windows Build Script
echo  ( see "build-exe-tutorial.md" for Chinese guide )
echo ====================================================
echo.

cd /d "%~dp0"

REM ============ Check Node.js ============
echo [1/5] Checking Node.js ...
where node >nul 2>nul
if errorlevel 1 goto NO_NODE
node --version
echo.

REM ============ Check Rust ============
echo [2/5] Checking Rust ...
where cargo >nul 2>nul
if errorlevel 1 goto NO_RUST
cargo --version
echo.

REM ============ Check WebView2 ============
echo [3/5] Checking WebView2 runtime ...
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>nul
if not errorlevel 1 goto WEBVIEW_OK
reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>nul
if not errorlevel 1 goto WEBVIEW_OK
echo   WARN: WebView2 not detected. Windows 10/11 usually has it.
echo         If missing, install from:
echo         https://developer.microsoft.com/microsoft-edge/webview2/
echo         (build will continue; runtime is only needed at app launch)
goto WEBVIEW_DONE
:WEBVIEW_OK
echo   OK: WebView2 installed.
:WEBVIEW_DONE
echo.

REM ============ Install dependencies ============
echo [4/5] Installing project dependencies ...
set NEED_INSTALL=0
if not exist "node_modules\.bin\vite.cmd" set NEED_INSTALL=1
if not exist "node_modules\react\package.json" set NEED_INSTALL=1
if not exist "node_modules\@tauri-apps\cli\package.json" set NEED_INSTALL=1
if not exist "node_modules\@tauri-apps\api\package.json" set NEED_INSTALL=1

if "%NEED_INSTALL%"=="0" goto SKIP_INSTALL
echo   First run or incomplete node_modules. Installing (1-3 min)...
call npm install
if errorlevel 1 goto INSTALL_FAILED
goto INSTALL_DONE

:SKIP_INSTALL
echo   OK: dependencies already installed.
:INSTALL_DONE
echo.

REM ============ Build ============
echo [5/5] Building .exe (this can take 10-30 min on first run) ...
echo   You'll see lots of "Compiling ..." lines. That is normal.
echo   When you see "Finished `release` profile", it's almost done.
echo.

call npm run tauri:build
if errorlevel 1 goto BUILD_FAILED

echo.
echo ====================================================
echo  Build SUCCESS
echo ====================================================
echo.
echo  Installer location:
echo  %CD%\src-tauri\target\release\bundle\nsis\
echo.
echo  Double-click the .exe to install on Windows.
echo.

if exist "src-tauri\target\release\bundle\nsis" (
  start "" "src-tauri\target\release\bundle\nsis"
)
pause
exit /b 0


:NO_NODE
echo.
echo   X Node.js not found.
echo.
echo   Install Node.js LTS from: https://nodejs.org
echo   (Just click Next through the installer.)
echo   After install, close this window and run again.
echo.
pause
exit /b 1


:NO_RUST
echo.
echo   X Rust compiler not found.
echo.
echo   Install Rust:
echo     1. Open https://www.rust-lang.org/tools/install
echo     2. Download and run rustup-init.exe
echo     3. Press 1 + Enter when prompted (default install)
echo     4. Wait 5-8 minutes for ~500MB download
echo     5. Close ALL command prompt windows
echo     6. Open this folder again and double-click this .bat
echo.
echo   Note: Rust includes the MSVC linker. No Visual Studio needed.
echo         If the Rust installer asks for "Microsoft C++ Build Tools",
echo         follow its link to install it (select "Desktop development with C++").
echo.
pause
exit /b 1


:INSTALL_FAILED
echo.
echo   X npm install failed.
echo.
echo   Possible fixes:
echo     1. Check your internet connection
echo     2. Delete the "node_modules" folder and run this script again
echo     3. Try a different npm registry:
echo        npm config set registry https://registry.npmmirror.com
echo.
pause
exit /b 1


:BUILD_FAILED
echo.
echo   X Build failed. Scroll up to read the red error lines.
echo.
echo   Common causes:
echo     - Missing "Microsoft C++ Build Tools" (run rustup-init.exe again
echo       and follow the link it gives you)
echo     - Network issue downloading Rust crates - just rerun this script
echo.
pause
exit /b 1
