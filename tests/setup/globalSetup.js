import { execSync } from 'node:child_process';
import { loadTestEnv } from './loadTestEnv.js';

/** Aplica las migraciones pendientes en la base de pruebas (operación no destructiva). */
export default function globalSetup() {
  const url = loadTestEnv();
  if (!url) {
    console.warn('\n⚠️  TEST_DATABASE_URL no definido: se omiten los tests que requieren base de datos.\n');
    return;
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
