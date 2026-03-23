module.exports = {
  apps: [{
    name: 'stolbiki-api',
    script: 'server.js',
    cwd: '/opt/stolbiki-api',
    env_file: '/opt/stolbiki-api/.env',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
}
