@echo off
echo === PyArsenal - Windows Build ===
echo.

REM Check prerequisites
where rustc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Rust not found. Install from https://rustup.rs/
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

rustc --version
node --version
npm --version
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing npm dependencies...
    npm ci
    echo.
)

REM Build
echo Building PyArsenal (this may take a few minutes on first build)...
npm run tauri build

echo.
echo === Build complete! ===
echo.
echo Output files:
dir /b src-tauri\target\release\bundle\nsis\*.exe 2>nul
dir /b src-tauri\target\release\bundle\msi\*.msi 2>nul
echo.
echo NSIS installer: src-tauri\target\release\bundle\nsis\
echo MSI installer:  src-tauri\target\release\bundle\msi\
pause
