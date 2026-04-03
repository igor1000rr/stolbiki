module.exports = {
  apps: [{
    name: 'stolbiki-api',
    script: 'server.js',
    cwd: '/opt/stolbiki-api',
    env_file: '/opt/stolbiki-api/.env',
    instances: 1,
    exec_mode: 'fork', // SQLite = один писатель, cluster не нужен
    autorestart: true,
    max_restarts: 10,
    watch: false,
    max_memory_restart: '300M',
    kill_timeout: 5000, // Graceful shutdown: 5 сек на завершение запросов
    listen_timeout: 8000,
    // Логи: ротация встроенная
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/stolbiki-api/logs/error.log',
    out_file: '/opt/stolbiki-api/logs/out.log',
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
}
