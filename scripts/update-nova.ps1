# Nova ERP Update Script
# This script automates the update process on the host server

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackupScript = Join-Path $ScriptDir "backup-db.ps1"
$RepoRoot = Split-Path -Parent $ScriptDir

# Öncelik sırası: prod > windows > dev
$ComposeFile = $null
foreach ($name in @("docker-compose.prod.yml", "docker-compose.windows.yml", "docker-compose.yml")) {
    $candidate = Join-Path $RepoRoot $name
    if (Test-Path $candidate) { $ComposeFile = $candidate; break }
}
if (-not $ComposeFile) {
    Write-Error "HATA: Hiçbir docker-compose dosyası bulunamadı!"
    exit 1
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "         Nova ERP Güncelleme Sihirbazı        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Run database backup first
if (Test-Path $BackupScript) {
    Write-Host "[1/3] Veri tabanı yedeği alınıyor..." -ForegroundColor Yellow
    & $BackupScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "HATA: Veri tabanı yedeği alınamadı! Güncelleme işlemi güvenlik amacıyla iptal edildi."
        exit 1
    }
} else {
    Write-Warning "UYARI: Yedekleme betiği (backup-db.ps1) bulunamadı! İşleme yedeksiz devam ediliyor."
}

Write-Host ""
Write-Host "[2/3] Güncel Docker imajları indiriliyor..." -ForegroundColor Yellow

# 2. Pull latest images
# Note: If using private registry, ensure 'docker login' was performed on the host beforehand.
docker compose -f $ComposeFile pull
if ($LASTEXITCODE -ne 0) {
    Write-Error "HATA: Docker imajları indirilemedi! İnternet bağlantınızı veya registry giriş bilgilerinizi kontrol edin."
    exit 1
}

Write-Host ""
Write-Host "[3/3] Konteynerler güncelleniyor ve yeniden başlatılıyor..." -ForegroundColor Yellow

# 3. Re-launch compose with the new images
docker compose -f $ComposeFile up -d --remove-orphans
if ($LASTEXITCODE -ne 0) {
    Write-Error "HATA: Servisler başlatılamadı!"
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Nova ERP başarıyla güncellendi ve başlatıldı!  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
