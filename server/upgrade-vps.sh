#!/bin/bash
# Апгрейд VPS: HTTPS, бэкапы, nginx, безопасность
# Поддержка двух доменов: highriseheist.com (новый) + snatch-highrise.com (старый, 301 редирект)
# Запуск: bash upgrade-vps.sh
set -e

NEW_DOMAIN="highriseheist.com"
OLD_DOMAIN="snatch-highrise.com"
API_PORT=3001

echo "═══════════════════════════════════════"
echo "  Апгрейд VPS — Highrise Heist"
echo "  Новый: $NEW_DOMAIN"
echo "  Старый (301 redirect): $OLD_DOMAIN"
echo "═══════════════════════════════════════"

# ─── 1. HTTPS (Let's Encrypt) ───
echo ""
echo "─── 1. HTTPS ───"
if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  apt-get install -y certbot python3-certbot-nginx
fi

NEW_CERT_OK=0
if [ ! -f "/etc/letsencrypt/live/$NEW_DOMAIN/fullchain.pem" ]; then
  echo "→ Получаю SSL для $NEW_DOMAIN..."
  certbot certonly --nginx -d "$NEW_DOMAIN" -d "www.$NEW_DOMAIN" --non-interactive --agree-tos --email admin@$NEW_DOMAIN && NEW_CERT_OK=1 || {
    echo "  ⚠ Не удалось — возможно DNS $NEW_DOMAIN ещё не пропагирован"
    echo "  Проверь: dig +short $NEW_DOMAIN (ожидается 178.212.12.71)"
  }
else
  NEW_CERT_OK=1
  echo "  ✅ Сертификат $NEW_DOMAIN уже есть"
fi

OLD_CERT_OK=0
[ -f "/etc/letsencrypt/live/$OLD_DOMAIN/fullchain.pem" ] && OLD_CERT_OK=1 && echo "  ✅ Сертификат $OLD_DOMAIN есть → будет 301 на новый"

# ─── 2. Nginx ───
echo ""
echo "─── 2. Nginx ───"

if [ "$NEW_CERT_OK" = "1" ]; then
cat > /etc/nginx/sites-available/stolbiki << NGINX
server {
    listen 80;
    server_name highriseheist.com www.highriseheist.com;
    return 301 https://highriseheist.com\$request_uri;
}

server {
    listen 443 ssl;
    server_name www.highriseheist.com;
    ssl_certificate /etc/letsencrypt/live/highriseheist.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/highriseheist.com/privkey.pem;
    return 301 https://highriseheist.com\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name highriseheist.com;

    ssl_certificate /etc/letsencrypt/live/highriseheist.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/highriseheist.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/octet-stream;
    gzip_min_length 256;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }

    location / {
        root /opt/stolbiki-web;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;

        location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; }
        location ~* \.(png|webp|ico|svg|woff2?|pdf)$ { add_header Cache-Control "public, max-age=604800" always; }
        location ~* \.(bin)$ { add_header Cache-Control "public, max-age=31536000, immutable" always; }
        location = /sw.js { add_header Cache-Control "no-cache, no-store, must-revalidate" always; }
    }
}
NGINX

  # 301 со старого домена
  if [ "$OLD_CERT_OK" = "1" ]; then
cat >> /etc/nginx/sites-available/stolbiki << NGINX

server {
    listen 80;
    server_name snatch-highrise.com www.snatch-highrise.com;
    return 301 https://highriseheist.com\$request_uri;
}

server {
    listen 443 ssl;
    server_name snatch-highrise.com www.snatch-highrise.com;
    ssl_certificate /etc/letsencrypt/live/snatch-highrise.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/snatch-highrise.com/privkey.pem;
    return 301 https://highriseheist.com\$request_uri;
}
NGINX
  fi

  ln -sf /etc/nginx/sites-available/stolbiki /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx && echo "  ✅ Nginx обновлён"
else
  echo "  ⚠ Пропускаю обновление nginx — новый домен не готов"
  echo "  Сначала: направь A-запись $NEW_DOMAIN на 178.212.12.71, потом запусти снова"
fi

# ─── 3. Бэкапы ───
echo ""
echo "─── 3. Бэкапы ───"
mkdir -p /opt/stolbiki-api/backups
command -v sqlite3 >/dev/null 2>&1 || apt-get install -y sqlite3

cat > /opt/stolbiki-api/backup.sh << 'BACKUP'
#!/bin/bash
DB="/opt/stolbiki-api/data/stolbiki.db"
DIR="/opt/stolbiki-api/backups"
MAX=28
mkdir -p "$DIR"
TS=$(date +%Y%m%d_%H%M%S)
F="$DIR/stolbiki_${TS}.db"
sqlite3 "$DB" ".backup '$F'" 2>/dev/null
if [ -f "$F" ] && [ "$(sqlite3 "$F" 'PRAGMA integrity_check;' 2>/dev/null)" != "ok" ]; then
  rm -f "$F"; exit 1
fi
cd "$DIR" && ls -t stolbiki_*.db 2>/dev/null | tail -n +$((MAX + 1)) | xargs -r rm --
echo "[$(date)] Backup: $(basename "$F")" >> /opt/stolbiki-api/logs/backup.log
BACKUP
chmod +x /opt/stolbiki-api/backup.sh

(crontab -l 2>/dev/null | grep -v stolbiki_backup | grep -v "backup.sh"; echo "0 */6 * * * /opt/stolbiki-api/backup.sh # stolbiki_backup") | crontab -
echo "  ✅ Бэкап: каждые 6ч"

# ─── 4. Безопасность ───
echo ""
echo "─── 4. Безопасность ───"
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp >/dev/null 2>&1
  ufw allow 80/tcp >/dev/null 2>&1
  ufw allow 443/tcp >/dev/null 2>&1
  ufw deny 3001 >/dev/null 2>&1
  ufw --force enable >/dev/null 2>&1
  echo "  ✅ UFW: 22/80/443 открыты, 3001 закрыт снаружи"
fi

# ─── 5. Проверка ───
echo ""
echo "═══════════════════════════════════════"
sleep 1
pm2 status stolbiki-api --no-daemon 2>/dev/null | grep -E "name|stolbiki" || echo "  ⚠ PM2 не запущен"
curl -s http://127.0.0.1:3001/api/health 2>/dev/null | grep -q '"status":"ok"' && echo "  ✅ API OK" || echo "  ⚠ API не отвечает"
[ "$NEW_CERT_OK" = "1" ] && (curl -sI "https://$NEW_DOMAIN" 2>/dev/null | grep -qE "200|301" && echo "  ✅ $NEW_DOMAIN работает" || echo "  ⚠ $NEW_DOMAIN не отвечает")
[ "$OLD_CERT_OK" = "1" ] && [ "$NEW_CERT_OK" = "1" ] && (curl -sI "https://$OLD_DOMAIN" 2>/dev/null | grep -q "301" && echo "  ✅ $OLD_DOMAIN → 301" || echo "  ⚠ $OLD_DOMAIN редирект не настроен")
echo ""
