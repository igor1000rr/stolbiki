#!/bin/bash
# Первоначальная настройка VPS для Стойки
# Запуск: bash setup-vps.sh
set -e

echo "═══════════════════════════════════════"
echo "  Настройка VPS для Стойки"
echo "═══════════════════════════════════════"

# ─── Node.js 20 ───
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  echo "→ Устанавливаю Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)"

# ─── PM2 ───
if ! command -v pm2 &>/dev/null; then
  echo "→ Устанавливаю PM2..."
  npm install -g pm2
fi

# ─── Nginx ───
if ! command -v nginx &>/dev/null; then
  echo "→ Устанавливаю nginx..."
  apt-get update && apt-get install -y nginx
fi

# ─── Директории ───
echo "→ Создаю директории..."
mkdir -p /opt/stolbiki-api/data
mkdir -p /opt/stolbiki-web

# ─── SSH ключ для GitHub Actions ───
SSH_KEY=/root/.ssh/stolbiki_deploy
if [ ! -f "$SSH_KEY" ]; then
  echo "→ Генерирую SSH ключ для деплоя..."
  ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "stolbiki-deploy"
  cat "$SSH_KEY.pub" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  СКОПИРУЙ ПРИВАТНЫЙ КЛЮЧ В GitHub Secrets:      ║"
  echo "║  Settings → Secrets → VPS_SSH_KEY               ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
  cat "$SSH_KEY"
  echo ""
  echo "─────────────────────────────────────────────"
fi

# ─── Копируем сервер ───
echo "→ Копирую серверные файлы..."
cp server/package.json /opt/stolbiki-api/ 2>/dev/null || cp package.json /opt/stolbiki-api/ 2>/dev/null || true
cp server/server.js /opt/stolbiki-api/ 2>/dev/null || cp server.js /opt/stolbiki-api/ 2>/dev/null || true
cp server/ecosystem.config.cjs /opt/stolbiki-api/ 2>/dev/null || cp ecosystem.config.cjs /opt/stolbiki-api/ 2>/dev/null || true

# ─── Зависимости ───
cd /opt/stolbiki-api
echo "→ Устанавливаю зависимости..."
npm install --production

# ─── JWT Secret ───
JWT_FILE=/opt/stolbiki-api/.env
if [ ! -f "$JWT_FILE" ]; then
  JWT_SECRET="stolbiki_$(openssl rand -hex 24)"
  echo "JWT_SECRET=$JWT_SECRET" > "$JWT_FILE"
  echo "DB_PATH=./data/stolbiki.db" >> "$JWT_FILE"
  echo "PORT=3001" >> "$JWT_FILE"
  echo "  JWT сохранён: $JWT_FILE"
fi

# ─── PM2 ───
echo "→ Запускаю API через PM2..."
pm2 delete stolbiki-api 2>/dev/null || true
cd /opt/stolbiki-api
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ─── Nginx ───
echo "→ Настраиваю nginx..."
IP=$(hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/stolbiki << NGINX
server {
    listen 80;
    server_name $IP;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Security
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;

    # API → Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }

    # Frontend (SPA)
    location / {
        root /opt/stolbiki-web;
        try_files \$uri \$uri/ /index.html;

        # Кэш статики
        location ~* \.(js|css|png|svg|ico|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX

ln -sf /etc/nginx/sites-available/stolbiki /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx && systemctl enable nginx

# ─── Бэкап БД (ежедневно в 3:00) ───
echo "→ Настраиваю бэкап БД..."
mkdir -p /opt/stolbiki-api/backups
cat > /opt/stolbiki-api/backup.sh << 'BACKUP'
#!/bin/bash
cp /opt/stolbiki-api/data/stolbiki.db "/opt/stolbiki-api/backups/stolbiki_$(date +%Y%m%d_%H%M).db"
# Храним последние 7 дней
find /opt/stolbiki-api/backups -name "*.db" -mtime +7 -delete
BACKUP
chmod +x /opt/stolbiki-api/backup.sh
(crontab -l 2>/dev/null | grep -v stolbiki_backup; echo "0 3 * * * /opt/stolbiki-api/backup.sh # stolbiki_backup") | crontab -

# ─── Проверка ───
echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Настройка завершена!"
echo "═══════════════════════════════════════"
echo ""
echo "  API:    http://$IP/api/health"
echo "  Сайт:   http://$IP"
echo "  PM2:    pm2 logs stolbiki-api"
echo "  БД:     /opt/stolbiki-api/data/stolbiki.db"
echo ""
echo "  GitHub Secrets (Settings → Secrets and variables → Actions):"
echo "    VPS_HOST = $IP"
echo "    VPS_SSH_KEY = (приватный ключ выше)"
echo ""
echo "  После добавления секретов — каждый push в main"
echo "  автоматически деплоит на сервер."
echo ""

# Тест API
sleep 2
curl -s http://127.0.0.1:3001/api/health | head -1 && echo " ← API работает" || echo "⚠ API не отвечает, проверь: pm2 logs stolbiki-api"
