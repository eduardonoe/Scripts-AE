# Setup-links.ps1
# Cria junctions/symlinks para que o After Effects leia os scripts direto
# da pasta do repositorio local. Depois de rodar isso UMA vez (como admin),
# qualquer edicao nos arquivos do repo passa a valer automaticamente no AE,
# sem precisar copiar/instalar de novo.
#
# Uso: clique com o botao direito neste arquivo e "Executar com PowerShell"
# (ele mesmo pede elevacao via UAC), ou rode:
#   powershell -ExecutionPolicy Bypass -File "Tools\setup-links.ps1"

param()

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host "Solicitando elevacao (UAC)..."
    Start-Process -FilePath "powershell" -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$repoRoot = Split-Path -Parent $PSScriptRoot

$cepExtensionsDir = "C:\Program Files\Common Files\Adobe\CEP\extensions"
$scriptUIDir = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts\ScriptUI Panels"

# name -> pasta real do CEP dentro do repo (a que contem CSXS\manifest.xml)
$cepLinks = @{
    "Swatch Colors"  = Join-Path $repoRoot "Swatch Colors\CEP Extension\Swatch Colors"
    "Layer Direction" = Join-Path $repoRoot "Layer Direction\CEP Extension\Layer Direction CEP Extension"
    "Momentum"        = Join-Path $repoRoot "Momentum\CEP Extension\Momentum"
}

# nome do arquivo no ScriptUI Panels -> caminho do .jsx no repo
$jsxLinks = @{
    "Text Splitter.jsx"      = Join-Path $repoRoot "Text Splitter\Text Splitter.jsx"
    "Precomp Extractor.jsx"  = Join-Path $repoRoot "Precomp Extractor\Precomp Extractor.jsx"
    "Layer Direction.jsx"    = Join-Path $repoRoot "Layer Direction\Layer Direction.jsx"
    "Swatch Colors.jsx"      = Join-Path $repoRoot "Swatch Colors\Swatch Colors.jsx"
    "Momentum.jsx"           = Join-Path $repoRoot "Momentum\Momentum.jsx"
}

Write-Host "=== Linkando extensoes CEP ==="
foreach ($name in $cepLinks.Keys) {
    $target = $cepLinks[$name]
    $linkPath = Join-Path $cepExtensionsDir $name

    if (-not (Test-Path $target)) {
        Write-Host "[SKIP] Origem nao encontrada: $target"
        continue
    }

    $existing = Get-Item $linkPath -ErrorAction SilentlyContinue

    if ($existing -and $existing.LinkType) {
        # Ja e um link: so serve se apontar para o alvo certo. Comparar o
        # destino evita deixar um link velho apontando para um caminho
        # que mudou de lugar no repositorio.
        $current = @($existing.Target)[0]
        if ($current -eq $target) {
            Write-Host "[OK] '$name' ja aponta para o lugar certo."
            continue
        }
        Write-Host "[REAPONTANDO] '$name'"
        Write-Host "              de:    $current"
        Write-Host "              para:  $target"
        # Remover um link apaga apenas o link, nunca o conteudo real.
        Remove-Item $linkPath -Recurse -Force
    }
    elseif ($existing) {
        # Pasta real instalada. NUNCA apagar direto: ela pode conter uma
        # versao que nao existe no repositorio (foi assim que a versao com
        # o botao ADD COLOR se perdeu). Guardar uma copia antes.
        $backup = Join-Path $repoRoot ("_backup-instalado\" + $name + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
        Write-Host "[ATENCAO] '$name' e uma pasta real, nao um link."
        Write-Host "          Fazendo backup antes de substituir, em:"
        Write-Host "          $backup"
        New-Item -ItemType Directory -Path $backup -Force | Out-Null
        Copy-Item -Path (Join-Path $linkPath "*") -Destination $backup -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $linkPath -Recurse -Force
    }

    New-Item -ItemType Junction -Path $linkPath -Target $target | Out-Null
    Write-Host "[LINKED] $name -> $target"
}

Write-Host ""
Write-Host "=== Linkando scripts ScriptUI Panels ==="
foreach ($fileName in $jsxLinks.Keys) {
    $target = $jsxLinks[$fileName]
    $linkPath = Join-Path $scriptUIDir $fileName

    if (-not (Test-Path $target)) {
        Write-Host "[SKIP] Origem nao encontrada: $target"
        continue
    }

    $existing = Get-Item $linkPath -ErrorAction SilentlyContinue

    if ($existing -and $existing.LinkType) {
        $current = @($existing.Target)[0]
        if ($current -eq $target) {
            Write-Host "[OK] '$fileName' ja aponta para o lugar certo."
            continue
        }
        Write-Host "[REAPONTANDO] '$fileName' -> $target"
        Remove-Item $linkPath -Force
    }
    elseif ($existing) {
        # Arquivo real instalado: guardar uma copia antes de substituir.
        $backupDir = Join-Path $repoRoot "_backup-instalado"
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        $backupFile = Join-Path $backupDir ($fileName + "-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".bak")
        Write-Host "[ATENCAO] '$fileName' e um arquivo real, nao um link."
        Write-Host "          Backup em: $backupFile"
        Copy-Item -Path $linkPath -Destination $backupFile -Force -ErrorAction SilentlyContinue
        Remove-Item $linkPath -Force
    }

    New-Item -ItemType SymbolicLink -Path $linkPath -Target $target | Out-Null
    Write-Host "[LINKED] $fileName -> $target"
}

Write-Host ""
Write-Host "=== Habilitando PlayerDebugMode (CEPs nao assinados) ==="
foreach ($v in 9..18) {
    New-Item -Path "HKCU:\Software\Adobe\CSXS.$v" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$v" -Name PlayerDebugMode -Value 1
}
Write-Host "OK"

Write-Host ""
Write-Host "Concluido. Reinicie o After Effects."
pause
