// PM2 — Haute disponibilité multi-instances
// Lancer : pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'link2me',
      script: 'src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        CLUSTER: 'false' // PM2 gère déjà le cluster
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
