import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';
import { closeBrowser } from './services/pdfService.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`✅ pdfcatalogo API escuchando en el puerto ${env.port} (${env.nodeEnv})`);
  console.log(`   CORS permitido: ${env.corsOrigins.join(', ') || '(ninguno)'}`);
});

async function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando servidor...`);
  server.close();
  await Promise.allSettled([closeBrowser(), prisma.$disconnect()]);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
