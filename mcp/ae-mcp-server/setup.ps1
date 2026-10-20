# Auto-Installer e Configurador do After Effects MCP Server para o Antigravity
$ErrorActionPreference = "Continue"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   INSTALADOR AFTER EFFECTS MCP SERVER (ANTIGRAVITY)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$CurrentDir = $PSScriptRoot
if (-not $CurrentDir) { $CurrentDir = (Get-Location).Path }

# 1. Instalar dependencias e compilar
Write-Host "1. Instalando dependencias e compilando o projeto..." -ForegroundColor Yellow
Set-Location -Path $CurrentDir
npm install
npm run build
Write-Host "[OK] Projeto compilado com sucesso!" -ForegroundColor Green
Write-Host ""

# 2. Localizar pasta Startup do After Effects em Program Files e AppData
Write-Host "2. Configurando inicializacao automatica no After Effects..." -ForegroundColor Yellow
$bridgeSource = Join-Path $CurrentDir "ae-bridge.jsx"
$installedCount = 0

# Procura em C:\Program Files\Adobe\Adobe After Effects *
$aeProgramFolders = Get-ChildItem -Path "C:\Program Files\Adobe" -Directory -Filter "Adobe After Effects*" -ErrorAction SilentlyContinue
foreach ($folder in $aeProgramFolders) {
    $startup = Join-Path $folder.FullName "Support Files\Scripts\Startup"
    if (Test-Path $startup) {
        Copy-Item -Path $bridgeSource -Destination (Join-Path $startup "ae-bridge.jsx") -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Ponte instalada na inicializacao de: $($folder.Name)" -ForegroundColor Green
        $installedCount++
    }
}

# Procura em AppData
$appDataAdobe = "$env:APPDATA\Adobe\After Effects"
if (Test-Path $appDataAdobe) {
    $aeVersions = Get-ChildItem -Path $appDataAdobe -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^\d+(\.\d+)?" }
    foreach ($v in $aeVersions) {
        $startupFolder = Join-Path $v.FullName "Scripts\Startup"
        if (-not (Test-Path $startupFolder)) {
            New-Item -ItemType Directory -Path $startupFolder -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Copy-Item -Path $bridgeSource -Destination (Join-Path $startupFolder "ae-bridge.jsx") -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Ponte instalada no perfil do usuario: $($v.Name)" -ForegroundColor Green
        $installedCount++
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   INSTALACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Como usar:" -ForegroundColor Yellow
Write-Host "1. No After Effects, certifique-se de marcar a opcao (uma unica vez):" -ForegroundColor White
Write-Host "   Edit > Preferences > Scripting & Expressions > 'Allow Scripts to Write Files and Access Network'" -ForegroundColor White
Write-Host ""
Write-Host "2. Toda vez que voce abrir o After Effects, o script sera executado AUTOMATICAMENTE na inicializacao!" -ForegroundColor Green
Write-Host "   Nao precisa clicar em 'File > Scripts > Run Script File' nunca mais." -ForegroundColor Green
Write-Host ""
