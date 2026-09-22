import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const backendCopy = path.resolve(import.meta.dirname, '../src/shared/renderModel.js');
const frontendCopy = path.resolve(import.meta.dirname, '../../frontend/src/shared/renderModel.js');

describe('renderModel compartido', () => {
  it.skipIf(!fs.existsSync(frontendCopy))('la copia del frontend es idéntica a la del backend (npm run sync:shared)', () => {
    const normalize = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(normalize(frontendCopy)).toBe(normalize(backendCopy));
  });
});
