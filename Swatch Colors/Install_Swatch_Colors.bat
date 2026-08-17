@echo off
setlocal
chcp 65001 >nul
title Swatch Colors CEP Installer
color 0b

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Requesting administrator permission...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo =======================================================
echo              SWATCH COLORS CEP INSTALLER
echo =======================================================
echo.

set "SOURCE_DIR=%~dp0Swatch Colors"
set "TARGET_DIR=C:\Program Files\Common Files\Adobe\CEP\extensions\Swatch Colors"

if not exist "%SOURCE_DIR%\CSXS\manifest.xml" (
    echo [ERROR] The "Swatch Colors" folder is missing or incomplete.
    echo Keep this installer beside the "Swatch Colors" folder.
    echo.
    pause
    exit /b 1
)

echo [1/3] Enabling unsigned CEP extensions...
for %%V in (9 10 11 12 13 14 15 16 17 18) do (
    reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)
echo       Done.
echo.

echo [2/3] Creating a clean system-wide installation folder...
if exist "%TARGET_DIR%" rmdir /S /Q "%TARGET_DIR%"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if errorlevel 1 (
    echo [ERROR] Could not create the installation folder.
    echo Target: "%TARGET_DIR%"
    echo.
    pause
    exit /b 1
)
echo       Done.
echo.

echo [3/3] Installing Swatch Colors...
xcopy "%SOURCE_DIR%\*" "%TARGET_DIR%\" /E /I /Y /Q >nul
if errorlevel 1 (
    echo [ERROR] The extension files could not be copied.
    echo.
    pause
    exit /b 1
)
echo       Done.
echo.

echo =======================================================
echo              INSTALLATION COMPLETE
echo =======================================================
echo.
echo Restart After Effects, then open:
echo Window ^> Extensions (Legacy) ^> Swatch Colors
echo.
echo Your active palette, recent history, and saved palettes are
echo stored separately and are preserved when the panel is updated.
echo.
pause
exit /b 0
