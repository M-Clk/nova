#Requires -RunAsAdministrator
# Nova ERP - Windows Kurulum Sihirbazi
# Bu scripti musteri bilgisayarinda Yonetici olarak calistirin.

param(
    [string]$InstallDir = "C:\Nova",
    [string]$BackupDir  = "C:\Nova_Backups"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "" ; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "       Nova ERP - Windows Kurulum            " -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Docker Desktop kontrolu -------------------------------------------------
Write-Step "Docker Desktop kontrol ediliyor..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Fail "Docker Desktop bulunamadi!"
    Write-Host ""
    Write-Host "  Docker Desktop'i su adresten indirin ve kurun:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host ""
    Write-Host "  Kurulum tamamlandiktan sonra bu scripti tekrar calistirin." -ForegroundColor Yellow
    exit 1
}

try {
    $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
    Write-OK "Docker Desktop calisiyor (v$dockerVersion)"
} catch {
    Write-Fail "Docker Desktop kurulu fakat calismiyor. Lutfen Docker Desktop'i baslatin."
    exit 1
}

# -- 2. Kurulum dizini olustur -------------------------------------------------
Write-Step "Kurulum dizini hazirlaniyor: $InstallDir"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    Write-OK "Dizin olusturuldu: $InstallDir"
} else {
    Write-Warn "Dizin zaten mevcut: $InstallDir (uzerine yazilacak)"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-OK "Yedekleme dizini olusturuldu: $BackupDir"
}

# -- 3. Dosyalari kopyala ------------------------------------------------------
Write-Step "Nova ERP dosyalari kopyalaniyor..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Split-Path -Parent $ScriptDir

$filesToCopy = @(
    "docker-compose.windows.yml",
    "version.json"
)
foreach ($f in $filesToCopy) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) {
        Copy-Item $src -Destination $InstallDir -Force
        Write-OK "Kopyalandi: $f"
    } else {
        Write-Warn "Bulunamadi (atlandi): $f"
    }
}

# scripts/ klasorunu kopyala
$scriptsSource = Join-Path $RepoRoot "scripts"
$scriptsDest   = Join-Path $InstallDir "scripts"
if (Test-Path $scriptsSource) {
    Copy-Item $scriptsSource -Destination $scriptsDest -Recurse -Force
    # Kurulum scriptinin kendisini de uzerine yaz (eski surumlerin uzerine yazilmasi icin)
    Copy-Item $MyInvocation.MyCommand.Path -Destination (Join-Path $scriptsDest "install-windows.ps1") -Force
    Write-OK "scripts/ klasoru kopyalandi"
}

# -- 4. backup-db.ps1 yedekleme dizinini guncelle ------------------------------
Write-Step "Yedekleme scripti yapilandiriliyor..."

$backupScript = Join-Path $scriptsDest "backup-db.ps1"
if (Test-Path $backupScript) {
    $content = Get-Content $backupScript -Raw
    $content = $content -replace '\$BackupDir\s*=\s*"[^"]*"', "`$BackupDir = `"$BackupDir`""
    Set-Content $backupScript $content -Encoding UTF8
    Write-OK "Yedekleme dizini ayarlandi: $BackupDir"
}

# -- 5. docker-compose.windows.yml yollarini guncelle --------------------------
Write-Step "Docker Compose dosyasi yapilandiriliyor..."

$composeFile = Join-Path $InstallDir "docker-compose.windows.yml"
if (Test-Path $composeFile) {
    $content = Get-Content $composeFile -Raw
    $escapedDir = $InstallDir.Replace("\", "\\")
    $content = $content -replace 'C:\\\\Nova:/host', "$escapedDir`:/host"
    $content = $content -replace 'C:\\\\Nova', $InstallDir
    $content = $content -replace 'C:\\Nova:/host', "$escapedDir`:/host"
    $content = $content -replace 'C:\\Nova', $InstallDir
    Set-Content $composeFile $content -Encoding UTF8
    Write-OK "Compose dosyasi guncellendi: $composeFile"
}

# -- 6. Baslangic scriptleri olustur -------------------------------------------
Write-Step "Yardimci scriptler olusturuluyor..."

$startScript = @"
Set-Location "$InstallDir"
docker compose -f docker-compose.windows.yml up -d
Write-Host "Nova ERP baslatildi!" -ForegroundColor Green
Write-Host "Arayuz: http://localhost:5173" -ForegroundColor Cyan
"@
Set-Content (Join-Path $InstallDir "nova-start.ps1") $startScript -Encoding UTF8

$stopScript = @"
Set-Location "$InstallDir"
docker compose -f docker-compose.windows.yml down
Write-Host "Nova ERP durduruldu." -ForegroundColor Yellow
"@
Set-Content (Join-Path $InstallDir "nova-stop.ps1") $stopScript -Encoding UTF8

Write-OK "nova-start.ps1 olusturuldu"
Write-OK "nova-stop.ps1 olusturuldu"

# -- 7. Masaustu kisayolu olustur ----------------------------------------------
Write-Step "Masaustu kisayolu olusturuluyor..."

$desktopPath  = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shortcutPath = Join-Path $desktopPath "Nova ERP.lnk"
$startPath    = Join-Path $InstallDir "nova-start.ps1"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath      = "powershell.exe"
$shortcut.Arguments       = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startPath`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description     = "Nova ERP Baslatici"
$shortcut.Save()

Write-OK "Masaustu kisayolu olusturuldu"

# -- 8. Imajlari indir ve baslatilan ---------------------------------------------
Write-Step "Nova ERP imajlari indiriliyor ve baslatiliyor..."
Write-Warn "Bu islem internet baglantisina gore birkas dakika surebilir..."

Set-Location $InstallDir
docker compose -f docker-compose.windows.yml pull
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker imajlari indirilemedi. Internet baglantinizi kontrol edin."
    exit 1
}

docker compose -f docker-compose.windows.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Servisler baslatilimadi."
    exit 1
}

# -- 9. Tamamlandi -------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "       Nova ERP Basariyla Kuruldu!           " -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Kurulum dizini  : $InstallDir" -ForegroundColor White
Write-Host "  Yedekleme dizini: $BackupDir"  -ForegroundColor White
Write-Host "  Uygulama adresi : http://localhost:5173"    -ForegroundColor White
Write-Host "  API adresi      : http://localhost:5000"    -ForegroundColor White
Write-Host ""
Write-Host "  Uygulamayi baslatmak icin masaustundeki" -ForegroundColor Yellow
Write-Host "  'Nova ERP' kisayolunu kullanin."         -ForegroundColor Yellow
Write-Host ""
