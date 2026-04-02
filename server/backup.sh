#!/bin/bash
# Автоматический бэкап SQLite каждые 6 часов
# Crontab: 0 */6 * * * /opt/stolbiki-api/backup.sh
# Использует sqlite3 .backup вместо cp для атомарности (WAL-safe)

DB="/opt/stolbiki-api/data/stolbiki.db"
BACKUP_DIR="/opt/stolbiki-api/backups"
MAX_BACKUPS=28  # 7 дней × 4 бэкапа/день

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/stolbiki_${TIMESTAMP}.db"

# sqlite3 .backup — атомарный бэкап, безопасен при активных записях
if command -v sqlite3 &>/dev/null; then
  sqlite3 "$DB" ".backup '$BACKUP_FILE'"
else
  # Fallback: cp с checkpoint для WAL
  sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null
  cp "$DB" "$BACKUP_FILE"
fi

# Проверяем целостность бэкапа
if [ -f "$BACKUP_FILE" ]; then
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null)
  if [ "$INTEGRITY" != "ok" ]; then
    echo "[$(date)] WARNING: backup integrity check failed!"
    rm -f "$BACKUP_FILE"
    exit 1
  fi
fi

# Удаляем старые бэкапы
cd "$BACKUP_DIR" && ls -t stolbiki_*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
SIZE=$(ls -lh "$BACKUP_FILE" 2>/dev/null | awk '{print $5}')
echo "[$(date)] Backup done: stolbiki_${TIMESTAMP}.db ($SIZE)"
