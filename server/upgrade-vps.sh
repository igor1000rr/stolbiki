#!/bin/bash
# Апгрейд VPS: HTTPS, бэкапы, nginx, безопасность
# Запуск: bash upgrade-vps.sh
set -e

DOMAIN="snatch-highrise.com"
API_PORT=3001

echo "═══════════════════════════════════════"
echo "  Апгрейд VPS — Snatch Highrise"
echo "═══════════════════════════════════════"

# ─── 1. HTTPS (Let's Encrypt) ───
echo ""
echo "─── 1. HTTPS ───"
if ! command -v certbot &>/dev/null; then
  echo "→ Устанавливаю certbot..."
  apt-get update -qq
  apt-get install -y certbot python3-certbot-nginx
fi

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "→ Получаю SSL-сертификат для $DOMAIN..."
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN --redirect
  echo "  ✅ HTTPS настроен"
else
  echo "  ✅ Сертификат уже есть — обновляю nginx конфиг"
  certbot renew --dry-run 2>/dev/null && echo "  ✅ Автообновление работает" || echo "  ⚠ Проверь certbot renew"
fi

# ─── 2. Nginx — полная перезапись конфига ───
echo ""
echo "─── 2. Nginx ───"
cat > /etc/nginx/sites-available/stolbiki << 'NGINX'
# Редирект HTTP → HTTPS
server {
    listen 80;
    server_name snatch-highrise.com www.snatch-highrise.com;
    return 301 https://snatch-highrise.com$request_uri;
}

# Редирект www → без www
server {
    listen 443 ssl;
    server_name www.snatch-highrise.com;
    ssl_certificate /etc/letsencrypt/live/snatch-highrise.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/snatch-highrise.com/privkey.pem;
    return 301 https://snatch-highrise.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name snatch-highrise.com;

    ssl_certificate /etc/letsencrypt/live/snatch-highrise.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/snatch-highrise.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/octet-stream;
    gzip_min_length 256;
    gzip_comp_level 6;

    # API → Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }

    # WebSocket → Node.js
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Frontend (SPA)
    location / {
        root /opt/stolbiki-web;
        try_files $uri $uri/ /index.html;

        # HTML — не кешировать (у Vite assets есть хеши)
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;

        # Хешированные ассеты — иммутабельный кеш
        location /assets/ {
            add_header Cache-Control "public, max-age=31536000, immutable" always;
        }

        # Маскот, иконки, шрифты — долгий кеш
        location ~* \.(png|webp|ico|svg|woff2?|pdf)$ {
            add_header Cache-Control "public, max-age=604800" always;
        }

        # GPU weights — очень долгий кеш (меняются редко)
        location ~* \.(bin)$ {
            add_header Cache-Control "public, max-age=31536000, immutable" always;
        }

        # Service Worker — не кешировать
        location = /sw.js {
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        }
    }
}
NGINX

ln -sf /etc/nginx/sites-available/stolbiki /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✅ Nginx обновлён"

# ─── 3. Бэкап SQLite (правильный) ───
echo ""
echo "─── 3. Бэкапы ───"
mkdir -p /opt/stolbiki-api/backups

# Устанавливаем sqlite3 если нет
if ! command -v sqlite3 &>/dev/null; then
  apt-get install -y sqlite3
fi

# Копируем улучшенный backup.sh
cp /opt/stolbiki-api/backup.sh /opt/stolbiki-api/backup.sh.bak 2>/dev/null || true
cat > /opt/stolbiki-api/backup.sh << 'BACKUP'
#!/bin/bash
# Атомарный бэкап SQLite (WAL-safe) каждые 6 часов
DB="/opt/stolbiki-api/data/stolbiki.db"
BACKUP_DIR="/opt/stolbiki-api/backups"
MAX_BACKUPS=28

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/stolbiki_${TIMESTAMP}.db"

# sqlite3 .backup — атомарный, безопасен при активных записях
sqlite3 "$DB" ".backup '$BACKUP_FILE'" 2>/dev/null

# Проверяем целостность
if [ -f "$BACKUP_FILE" ]; then
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null)
  if [ "$INTEGRITY" != "ok" ]; then
    echo "[$(date)] WARNING: integrity check failed!" >> /opt/stolbiki-api/logs/backup.log
    rm -f "$BACKUP_FILE"
    exit 1
  fi
fi

# Удаляем старые
cd "$BACKUP_DIR" && ls -t stolbiki_*.db 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
SIZE=$(ls -lh "$BACKUP_FILE" 2>/dev/null | awk '{print $5}')
echo "[$(date)] Backup: stolbiki_${TIMESTAMP}.db ($SIZE)" >> /opt/stolbiki-api/logs/backup.log
BACKUP
chmod +x /opt/stolbiki-api/backup.sh

# Cron: бэкап каждые 6 часов
(crontab -l 2>/dev/null | grep -v stolbiki_backup | grep -v "backup.sh"; echo "0 */6 * * * /opt/stolbiki-api/backup.sh # stolbiki_backup") | crontab -
echo "  ✅ Бэкап: каждые 6ч, sqlite3 .backup, integrity check, 7 дней"

# ─── 4. Certbot auto-renew cron ───
echo ""
echo "─── 4. Certbot auto-renew ───"
# Certbot обычно ставит свой systemd timer, но проверим
if systemctl is-active --quiet certbot.timer 2>/dev/null; then
  echo "  ✅ certbot.timer активен"
else
  (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx' # certbot") | crontab -
  echo "  ✅ Cron: certbot renew каждый день в 3:00"
fi

# ─── 5. Безопасность ───
echo ""
echo "─── 5. Безопасность ───"
# Закрываем порт 3001 снаружи (только через nginx)
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp >/dev/null 2>&1
  ufw allow 80/tcp >/dev/null 2>&1
  ufw allow 443/tcp >/dev/null 2>&1
  ufw deny 3001 >/dev/null 2>&1
  ufw --force enable >/dev/null 2>&1
  echo "  ✅ UFW: 22, 80, 443 открыты. 3001 закрыт снаружи"
else
  echo "  ⚠ UFW не установлен — рекомендуется: apt install ufw"
fi

# ─── 6. Проверка ───
echo ""
echo "═══════════════════════════════════════"
echo "  Проверка"
echo "═══════════════════════════════════════"
echo ""

# PM2
pm2 status stolbiki-api --no-daemon 2>/dev/null | grep -E "name|stolbiki" || echo "  ⚠ PM2: stolbiki-api не запущен"

# API health
sleep 1
HEALTH=$(curl -s http://127.0.0.1:3001/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  VERSION=$(echo "$HEALTH" | grep -oP '"version":"[^"]+"' | cut -d'"' -f4)
  NODE=$(echo "$HEALTH" | grep -oP '"node":"[^"]+"' | cut -d'"' -f4)
  echo "  ✅ API: v$VERSION, $NODE"
else
  echo "  ⚠ API не отвечает"
fi

# HTTPS
if curl -sI "https://$DOMAIN" 2>/dev/null | grep -q "200\|301\|302"; then
  echo "  ✅ HTTPS: https://$DOMAIN работает"
else
  echo "  ⚠ HTTPS: проверь https://$DOMAIN"
fi

# Backup cron
if crontab -l 2>/dev/null | grep -q stolbiki_backup; then
  echo "  ✅ Cron: бэкап настроен"
else
  echo "  ⚠ Cron: бэкап не найден"
fi

# Disk
DISK_USED=$(df -h / | awk 'NR==2{print $5}')
DB_SIZE=$(ls -lh /opt/stolbiki-api/data/stolbiki.db 2>/dev/null | awk '{print $5}')
BACKUPS=$(ls /opt/stolbiki-api/backups/*.db 2>/dev/null | wc -l)
echo "  📊 Диск: $DISK_USED использовано, БД: ${DB_SIZE:-N/A}, бэкапов: $BACKUPS"

echo ""
echo "  Готово! Следующие шаги:"
echo "  1. Проверь https://$DOMAIN в браузере"
echo "  2. Google Play: keystore + $25 аккаунт"
echo ""
