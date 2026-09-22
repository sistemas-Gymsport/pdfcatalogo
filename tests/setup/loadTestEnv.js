import fs from 'node:fs';
import path from 'node:path';

/**
 * Carga .env.test (si existe) y devuelve la URL de la base de datos de pruebas.
 * Por seguridad, el nombre de la base de datos debe contener "test":
 * los tests BORRAN todos los datos de esa base.
 */
export function loadTestEnv() {
  const file = path.resolve(import.meta.dirname, '../../.env.test');
  if (fs.existsSync(file)) process.loadEnvFile(file);

  const url = process.env.TEST_DATABASE_URL || '';
  if (!url) return null;

  const dbName = new URL(url).pathname.replace('/', '');
  if (!dbName.toLowerCase().includes('test')) {
    throw new Error(`TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "test" (actual: "${dbName}").`);
  }
  return url;
}
