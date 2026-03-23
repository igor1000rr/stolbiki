#!/bin/bash
# Деплой Стойки API на VPS
# Запуск: bash deploy.sh

set -e

echo "═══ Деплой Стойки API ═══"

# Зависимости
if ! command -v node &> /dev/null; then
  echo "Устанавливаю Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
  echo "Устанавливаю PM2..."
  npm install -g pm2
fi

# Nginx
if ! command -v nginx &> /dev/null; then
  echo "Устанавливаю nginx..."
  apt-get update && apt-get install -y nginx
fi

# Директория
APP_DIR=/opt/stolbiki-api
mkdir -p $APP_DIR/data

# Копируем файлы
cp package.json server.js $APP_DIR/
cd $APP_DIR

# Зависимости
npm install --production

# PM2
pm2 delete stolbiki-api 2>/dev/null || true
JWT_SECRET="stolbiki_prod_$(openssl rand -hex 16)" \
DB_PATH="./data/stolbiki.db" \
PORT=3001 \
pm2 start server.js --name stolbiki-api
pm2 save

# Nginx конфиг
cat > /etc/nginx/sites-available/stolbiki-api << 'NGINX'
server {
    listen 80;
    server_name _;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Фронтенд (SPA)
    location / {
        root /opt/stolbiki-web;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/stolbiki-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# PM2 автостарт
pm2 startup systemd -u root --hp /root 2>/dev/null || true
pm2 save

echo ""
echo "✅ API запущен: http://$(hostname -I | awk '{print $1}'):3001/api/health"
echo "✅ Nginx: http://$(hostname -I | awk '{print $1}')"
echo "   БД: $APP_DIR/data/stolbiki.db"
echo "   Логи: pm2 logs stolbiki-api"
