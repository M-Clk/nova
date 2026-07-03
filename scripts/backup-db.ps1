# Backup configuration
$ContainerName = "nova-db-1"
$DbUser = "nova"
$DbName = "novadb"
$BackupDir = "D:\Nova_Backups"
$RetentionDays = 10 # Delete backups older than 10 days

# Create timestamp for unique filename
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "novadb_backup_$Timestamp.dump"
$TempContainerPath = "/tmp/$BackupFile"
$LocalBackupPath = Join-Path $BackupDir $BackupFile

# Ensure the local backup directory exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "Starting database backup process..." -ForegroundColor Cyan

# 1. Check if container is running
$ContainerStatus = docker inspect --format='{{.State.Running}}' $ContainerName 2>$null
if ($ContainerStatus -ne "true") {
    Write-Error "Error: Container $ContainerName is not running. Please make sure Docker is started and running."
    exit 1
}

# 2. Run pg_dump inside the container to a temporary file
Write-Host "Creating backup dump inside container..." -ForegroundColor Yellow
docker exec $ContainerName pg_dump -U $DbUser -d $DbName -F c -f $TempContainerPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: pg_dump execution failed."
    exit 1
}

# 3. Copy the dump file from the container to host D: drive
Write-Host "Copying backup to local storage ($LocalBackupPath)..." -ForegroundColor Yellow
docker cp "${ContainerName}:${TempContainerPath}" $LocalBackupPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Failed to copy backup file from container."
    exit 1
}

# 4. Remove the temporary dump file inside the container
Write-Host "Cleaning up temporary files inside container..." -ForegroundColor Yellow
docker exec $ContainerName rm $TempContainerPath

# 5. Retention policy: Remove backups older than $RetentionDays
Write-Host "Applying retention policy (keeping last $RetentionDays days of backups)..." -ForegroundColor Yellow
Get-ChildItem -Path $BackupDir -Filter "novadb_backup_*.dump" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)
} | Remove-Item -Force

Write-Host "Backup completed successfully! Saved to: $LocalBackupPath" -ForegroundColor Green
