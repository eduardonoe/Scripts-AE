@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Swatch Colors - ScriptUI Panel Installer
color 0b

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Requesting administrator permission...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo =======================================================
echo        SWATCH COLORS - SCRIPTUI PANEL INSTALLER
echo =======================================================
echo.
echo This installs the standalone .jsx panel (no CEP required).
echo To install the CEP extension instead, run
echo Install_Swatch_Colors.bat
echo.

set "SOURCE_FILE=%~dp0Swatch Colors.jsx"

if not exist "%SOURCE_FILE%" (
    echo [ERROR] "Swatch Colors.jsx" was not found next to this installer.
    echo Keep this file in the same folder as the script.
    echo.
    pause
    exit /b 1
)

set "FOUND=0"

echo [1/2] Looking for After Effects installations...
for /d %%D in ("C:\Program Files\Adobe\Adobe After Effects *") do (
    set "PANELS=%%~fD\Support Files\Scripts\ScriptUI Panels"
    if exist "!PANELS!" (
        echo       Found: %%~nxD
        set "FOUND=1"
    )
)

if "%FOUND%"=="0" (
    echo [ERROR] No After Effects installation was found under
    echo         C:\Program Files\Adobe
    echo.
    pause
    exit /b 1
)
echo.

echo [2/2] Installing Swatch Colors.jsx...
for /d %%D in ("C:\Program Files\Adobe\Adobe After Effects *") do (
    set "PANELS=%%~fD\Support Files\Scripts\ScriptUI Panels"
    if exist "!PANELS!" (
        rem Remove the previous version first so an old copy - or a
        rem development symlink - is never left behind.
        if exist "!PANELS!\Swatch Colors.jsx" del /F /Q "!PANELS!\Swatch Colors.jsx" >nul 2>&1
        copy /Y "%SOURCE_FILE%" "!PANELS!\Swatch Colors.jsx" >nul
        if errorlevel 1 (
            echo       [FAILED] %%~nxD
        ) else (
            echo       [OK] %%~nxD
        )
    )
)
echo.

echo =======================================================
echo              INSTALLATION COMPLETE
echo =======================================================
echo.
echo Restart After Effects, then open:
echo Window ^> Swatch Colors.jsx
echo.
echo Saved palettes are stored in your user profile and are
echo preserved when the script is updated.
echo.
pause
exit /b 0
