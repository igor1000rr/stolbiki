#!/bin/bash
# Бэкап SQLite базы данных Стоек
# Запуск: bash server/backup.sh
# Cron: 0 3 * * * cd /root/stolbiki && bash server/backup.sh

BACKUP_DIR="/root/stolbiki-backups"
DB_PATH="/root/stolbiki/server/stolbiki.db"
DATE=$(date +%Y-%m-%d_%H-%M)

mkdir -p "$BACKUP_DIR"

# Бэкап через SQLite .backup (безопасно при работающем сервере)
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/stolbiki-$DATE.db'"

# Удаляем бэкапы старше 30 дней
find "$BACKUP_DIR" -name "stolbiki-*.db" -mtime +30 -delete

echo "Backup: $BACKUP_DIR/stolbiki-$DATE.db ($(du -h "$BACKUP_DIR/stolbiki-$DATE.db" | cut -f1))"
