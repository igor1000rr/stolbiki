#!/bin/bash
# Бэкап SQLite базы данных Стоек
# Запуск: bash /opt/stolbiki-api/backup.sh
# Cron: 0 3 * * * bash /opt/stolbiki-api/backup.sh

BACKUP_DIR="/root/stolbiki-backups"
# Путь совпадает с DB_PATH в server.js (./data/stolbiki.db от cwd /opt/stolbiki-api)
DB_PATH="/opt/stolbiki-api/data/stolbiki.db"
DATE=$(date +%Y-%m-%d_%H-%M)

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "ОШИБКА: БД не найдена: $DB_PATH"
  exit 1
fi

# Бэкап через SQLite .backup (безопасно при работающем сервере)
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/stolbiki-$DATE.db'"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_DIR/stolbiki-$DATE.db" | cut -f1)
  echo "$(date): OK — $BACKUP_DIR/stolbiki-$DATE.db ($SIZE)"
else
  echo "$(date): ОШИБКА бэкапа!"
  exit 1
fi

# Удаляем бэкапы старше 30 дней
find "$BACKUP_DIR" -name "stolbiki-*.db" -mtime +30 -delete
