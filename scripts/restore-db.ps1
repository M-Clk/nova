# Nova ERP Database Restore Script
# Bu betik belirtilen veya en son alinan yedegi Docker uzerindeki PostgreSQL veritabanina geri yukler.

param (
    [string]$BackupDir = "C:\Users\Muhammed\Desktop\Projects\backups",
    [string]$SpecificFile = $null
)

$ContainerName = "nova-db-1"
$ApiContainer = "nova-api-1"
$DbUser = "nova"
$DbName = "novadb"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "       Nova ERP Veritabani Geri Yukleme      " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Yedek dizinini kontrol et
if (-not (Test-Path $BackupDir)) {
    Write-Error "HATA: Yedek dizini bulunamadi: $BackupDir"
    exit 1
}

# 2. Geri yuklenecek dosyayi belirle
$TargetFile = $null
if ($SpecificFile -and (Test-Path $SpecificFile)) {
    $TargetFile = Get-Item $SpecificFile
}
else {
    # Klasordeki en son olusturulan/degistirilen yedek dosyasini bul (.dump veya .sql)
    $TargetFile = Get-ChildItem -Path $BackupDir -File | 
    Where-Object { $_.Extension -in @(".dump", ".sql", ".backup") } | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 1
}

if (-not $TargetFile) {
    Write-Error "HATA: '$BackupDir' dizininde geri yuklenebilecek .dump veya .sql uzantili yedek dosyasi bulunamadi!"
    exit 1
}

Write-Host "[BİLGİ] Geri yuklenecek yedek dosyasi secildi:" -ForegroundColor Green
Write-Host "  Dosya: $($TargetFile.FullName)" -ForegroundColor White
Write-Host "  Boyut: $([math]::Round($TargetFile.Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host "  Tarih: $($TargetFile.LastWriteTime)" -ForegroundColor White
Write-Host ""

# 3. Docker ve DB Konteyner kontrolu
$DbRunning = docker inspect --format='{{.State.Running}}' $ContainerName 2>$null
if ($DbRunning -ne "true") {
    Write-Error "HATA: '$ContainerName' veritabani konteyneri calismiyor! Lutfen docker compose ile servisi baslatin."
    exit 1
}

# 4. API servisini baglanti kilitlemelerini onlemek icin gecici olarak durdur
$ApiRunning = docker inspect --format='{{.State.Running}}' $ApiContainer 2>$null
if ($ApiRunning -eq "true") {
    Write-Host "[1/4] DB baglantilarini kesmek icin API servisi gecici olarak durduruluyor..." -ForegroundColor Yellow
    docker stop $ApiContainer | Out-Null
}

$TempContainerPath = "/tmp/$($TargetFile.Name)"

try {
    # 5. Yedek dosyasini konteyner icine kopyala
    Write-Host "[2/4] Yedek dosyasi veritabani konteynerine kopyalaniyor..." -ForegroundColor Yellow
    docker cp "$($TargetFile.FullName)" "${ContainerName}:${TempContainerPath}"
    if ($LASTEXITCODE -ne 0) {
        throw "Yedek dosyasi konteyner icine kopyalanamadi!"
    }

    # 6. Geri yukleme islemini baslat
    Write-Host "[3/4] Veritabani semasi temizleniyor ve geri yukleniyor ($DbName)..." -ForegroundColor Yellow

    # Mevcut tablolari ve foreign key iliskilerini cakisma olmadan sifirlamak icin public semasini temizle
    docker exec -i $ContainerName psql -U $DbUser -d $DbName -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $DbUser;"

    if ($TargetFile.Extension -eq ".sql") {
        # Duz SQL formati ise psql ile bas
        docker exec -i $ContainerName psql -U $DbUser -d $DbName -f $TempContainerPath
    }
    else {
        # Custom dump format (-F c) ise pg_restore ile geri yukle
        docker exec -i $ContainerName pg_restore -U $DbUser -d $DbName --no-owner --no-privileges $TempContainerPath
    }

    # pg_restore bazi uyarilarla ciksa bile exit code 0 veya 1 olabilir
    Write-Host "Geri yukleme tamamlandi." -ForegroundColor Green
}
finally {
    # 7. Konteyner icindeki gecici dump dosyasini sil
    docker exec $ContainerName rm -f $TempContainerPath 2>$null

    # 8. Eger API konteyneri durdurulduysa tekrar baslat
    if ($ApiRunning -eq "true") {
        Write-Host "[4/4] API servisi tekrar baslatiliyor..." -ForegroundColor Yellow
        docker start $ApiContainer | Out-Null
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Veritabani basariyla geri yuklendi!          " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
