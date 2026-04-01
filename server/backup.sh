#!/bin/bash
# Автоматический бэкап SQLite каждые 6 часов
# Crontab: 0 */6 * * * /opt/stolbiki-api/backup.sh

DB="/opt/stolbiki-api/stolbiki.db"
BACKUP_DIR="/opt/stolbiki-api/backups"
MAX_BACKUPS=28  # 7 дней × 4 бэкапа/день

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp "$DB" "$BACKUP_DIR/stolbiki_${TIMESTAMP}.db"

# Удаляем старые бэкапы
cd "$BACKUP_DIR" && ls -t stolbiki_*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
echo "[$(date)] Backup done: stolbiki_${TIMESTAMP}.db ($(ls -lh "$BACKUP_DIR/stolbiki_${TIMESTAMP}.db" | awk '{print $5}'))"
