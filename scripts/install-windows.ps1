#Requires -RunAsAdministrator
# Nova ERP - Windows Kurulum Sihirbazı
# Bu scripti müşteri bilgisayarında Yönetici olarak çalıştırın.

param(
    [string]$InstallDir = "C:\Nova",
    [string]$BackupDir  = "C:\Nova_Backups"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n  ► $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  ✗ $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        Nova ERP — Windows Kurulum        ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Docker Desktop kontrolü ──────────────────────────────────────────────────
Write-Step "Docker Desktop kontrol ediliyor..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Fail "Docker Desktop bulunamadı!"
    Write-Host ""
    Write-Host "  Docker Desktop'ı şu adresten indirin ve kurun:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host ""
    Write-Host "  Kurulum tamamlandıktan sonra bu scripti tekrar çalıştırın." -ForegroundColor Yellow
    exit 1
}

try {
    $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
    Write-OK "Docker Desktop çalışıyor (v$dockerVersion)"
} catch {
    Write-Fail "Docker Desktop kurulu fakat çalışmıyor. Lütfen Docker Desktop'ı başlatın."
    exit 1
}

# ── 2. Kurulum dizini oluştur ───────────────────────────────────────────────────
Write-Step "Kurulum dizini hazırlanıyor: $InstallDir"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    Write-OK "Dizin oluşturuldu: $InstallDir"
} else {
    Write-Warn "Dizin zaten mevcut: $InstallDir (üzerine yazılacak)"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-OK "Yedekleme dizini oluşturuldu: $BackupDir"
}

# ── 3. Dosyaları kopyala ────────────────────────────────────────────────────────
Write-Step "Nova ERP dosyaları kopyalanıyor..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Split-Path -Parent $ScriptDir  # scripts/ → repo root

$filesToCopy = @(
    "docker-compose.windows.yml",
    "version.json"
)
foreach ($f in $filesToCopy) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) {
        Copy-Item $src -Destination $InstallDir -Force
        Write-OK "Kopyalandı: $f"
    } else {
        Write-Warn "Bulunamadı (atlandı): $f"
    }
}

# scripts/ klasörünü kopyala
$scriptsSource = Join-Path $RepoRoot "scripts"
$scriptsDest   = Join-Path $InstallDir "scripts"
if (Test-Path $scriptsSource) {
    Copy-Item $scriptsSource -Destination $scriptsDest -Recurse -Force
    Write-OK "scripts/ klasörü kopyalandı"
}

# ── 4. backup-db.ps1 içindeki yedekleme dizinini güncelle ──────────────────────
Write-Step "Yedekleme scripti yapılandırılıyor..."

$backupScript = Join-Path $scriptsDest "backup-db.ps1"
if (Test-Path $backupScript) {
    $content = Get-Content $backupScript -Raw
    $content = $content -replace '\$BackupDir\s*=\s*"[^"]*"', "`$BackupDir = `"$BackupDir`""
    Set-Content $backupScript $content -Encoding UTF8
    Write-OK "Yedekleme dizini ayarlandı: $BackupDir"
}

# ── 5. docker-compose.windows.yml içindeki yolları güncelle ────────────────────
Write-Step "Docker Compose dosyası yapılandırılıyor..."

$composeFile = Join-Path $InstallDir "docker-compose.windows.yml"
if (Test-Path $composeFile) {
    $content = Get-Content $composeFile -Raw
    # Host volume mount yolunu güncelle
    $escapedDir = $InstallDir.Replace("\", "\\")
    $content = $content -replace 'C:\\Nova:/host', "$escapedDir`:/host"
    $content = $content -replace 'C:\\Nova', $InstallDir
    Set-Content $composeFile $content -Encoding UTF8
    Write-OK "Compose dosyası güncellendi: $composeFile"
}

# ── 6. Başlangıç scripti oluştur ────────────────────────────────────────────────
Write-Step "Başlangıç kısayolu oluşturuluyor..."

$startScript = @"
# Nova ERP Başlat
Set-Location "$InstallDir"
docker compose -f docker-compose.windows.yml up -d
Write-Host "Nova ERP başlatıldı!" -ForegroundColor Green
Write-Host "Arayüz: http://localhost:5173" -ForegroundColor Cyan
"@
$startScriptPath = Join-Path $InstallDir "nova-start.ps1"
Set-Content $startScriptPath $startScript -Encoding UTF8

$stopScript = @"
# Nova ERP Durdur
Set-Location "$InstallDir"
docker compose -f docker-compose.windows.yml down
Write-Host "Nova ERP durduruldu." -ForegroundColor Yellow
"@
$stopScriptPath = Join-Path $InstallDir "nova-stop.ps1"
Set-Content $stopScriptPath $stopScript -Encoding UTF8

Write-OK "Başlatma scripti: $startScriptPath"
Write-OK "Durdurma scripti: $stopScriptPath"

# ── 7. Masaüstü kısayolu ────────────────────────────────────────────────────────
Write-Step "Masaüstü kısayolu oluşturuluyor..."

$desktopPath = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shortcutPath = Join-Path $desktopPath "Nova ERP.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments  = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScriptPath`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "Nova ERP Başlat"
$shortcut.Save()

Write-OK "Masaüstü kısayolu oluşturuldu"

# ── 8. İlk çalıştırma ──────────────────────────────────────────────────────────
Write-Step "Nova ERP imajları indiriliyor ve başlatılıyor..."
Write-Warn "Bu işlem internet bağlantısına göre birkaç dakika sürebilir..."

Set-Location $InstallDir
docker compose -f docker-compose.windows.yml pull
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker imajları indirilemedi. İnternet bağlantınızı kontrol edin."
    exit 1
}

docker compose -f docker-compose.windows.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Servisler başlatılamadı."
    exit 1
}

# ── 9. Tamamlandı ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║       Nova ERP Başarıyla Kuruldu!        ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  📁 Kurulum dizini : $InstallDir" -ForegroundColor White
Write-Host "  💾 Yedekleme dizini: $BackupDir" -ForegroundColor White
Write-Host "  🌐 Uygulama adresi : http://localhost:5173" -ForegroundColor White
Write-Host "  🔧 API adresi      : http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "  Uygulamayı başlatmak için masaüstündeki" -ForegroundColor Yellow
Write-Host "  'Nova ERP' kısayolunu kullanın." -ForegroundColor Yellow
Write-Host ""
