const { join } = require('path');

/**
 * Chrome se descarga dentro del proyecto (no en ~/.cache) para que Render
 * lo conserve entre la fase de build y la de ejecución.
 * Solo se necesita "chrome-headless-shell" para generar PDFs.
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  chrome: { skipDownload: true },
  'chrome-headless-shell': { skipDownload: false },
};
