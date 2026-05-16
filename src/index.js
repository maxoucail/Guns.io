'use strict';

require('dotenv').config();
const os = require('os');
const cluster = require('cluster');
const Logger = require('./utils/Logger');
const Server = require('./server');

const useCluster = process.env.CLUSTER === 'true';
const workers = process.env.WORKERS === 'auto' || !process.env.WORKERS
  ? os.cpus().length
  : Math.max(1, parseInt(process.env.WORKERS, 10) || 1);

if (useCluster && cluster.isPrimary) {
  Logger.info(`Master ${process.pid} lance ${workers} worker(s)`);
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    Logger.warn(`Worker ${worker.process.pid} mort (${signal || code}). Restart.`);
    cluster.fork();
  });

  const shutdown = () => {
    Logger.info('Master : arrêt propre des workers');
    for (const id in cluster.workers) cluster.workers[id].kill('SIGTERM');
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  const server = new Server();
  server.start().catch((err) => {
    Logger.error('Démarrage impossible', err);
    process.exit(1);
  });
}
