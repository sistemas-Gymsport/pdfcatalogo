import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { renderCatalogHtml } from '../renderer/renderCatalogHtml.js';
import { getCatalog } from './catalogService.js';

/**
 * Generación de PDF con Chromium headless (Puppeteer):
 * el mismo motor que muestra el editor, respetando @page, mm, fuentes e imágenes.
 *
 * Pensado para instancias con poca memoria (Render Free, 512 MB):
 *  - se generan PDF_MAX_CONCURRENT PDFs a la vez (por defecto 1; los demás esperan en cola);
 *  - el navegador se reutiliza mientras hay trabajo y se cierra tras BROWSER_IDLE_MS sin uso,
 *    para no ocupar memoria mientras nadie genera PDFs.
 */
const MAX_CONCURRENT = env.pdfMaxConcurrent;
const BROWSER_IDLE_MS = 60 * 1000;
let active = 0;
const queue = [];
let browserPromise = null;
let idleTimer = null;

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (active === 0) closeBrowser();
  }, BROWSER_IDLE_MS);
  idleTimer.unref?.();
}

async function acquire() {
  clearTimeout(idleTimer);
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise((resolve) => queue.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  const next = queue.shift();
  if (next) next();
  else if (active === 0) scheduleIdleClose();
}

async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser?.connected) return browser;
  }
  browserPromise = puppeteer.launch({
    // "shell" = chrome-headless-shell: más liviano, suficiente para generar PDF.
    headless: 'shell',
    executablePath: env.puppeteerExecutablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // /dev/shm es pequeño en contenedores
      '--disable-gpu',
      '--disable-extensions',
      '--font-render-hinting=none',
    ],
  });
  return browserPromise;
}

export async function closeBrowser() {
  const browser = await browserPromise?.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => {});
}

/** Convierte HTML en PDF esperando fuentes e imágenes. */
export async function htmlToPdf(html) {
  await acquire();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    page.setDefaultTimeout(env.pdfTimeoutMs);
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: ['load', 'networkidle0'], timeout: env.pdfTimeoutMs });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
      );
    });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: env.pdfTimeoutMs,
    });
    return Buffer.from(pdf);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('[pdf]', error);
    throw new AppError('No se pudo generar el PDF. Intenta nuevamente.', 500, 'PDF_GENERATION_FAILED');
  } finally {
    await page?.close().catch(() => {});
    release();
  }
}

/** Une varios PDFs (lotes de páginas) en uno solo, en orden. */
async function mergePdfs(buffers) {
  if (buffers.length === 1) return buffers[0];
  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const part = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(part, part.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save({ useObjectStreams: false }));
}

/**
 * Base de datos → catálogo → renderer → PDF.
 * Las páginas se procesan por lotes (PDF_PAGES_PER_BATCH): cada lote se renderiza
 * en una pestaña que se cierra al terminar, así Chromium solo decodifica las
 * imágenes de pocas páginas a la vez y la memoria no crece con el tamaño del catálogo.
 */
export async function generateCatalogPdf(catalogId) {
  const catalog = await getCatalog(catalogId);
  if (!catalog.pages.length) throw AppError.badRequest('El catálogo no tiene páginas', 'EMPTY_CATALOG');

  const size = env.pdfPagesPerBatch;
  const buffers = [];
  for (let start = 0; start < catalog.pages.length; start += size) {
    const batch = { ...catalog, pages: catalog.pages.slice(start, start + size) };
    buffers.push(await htmlToPdf(renderCatalogHtml(batch, { mode: 'print' })));
  }
  return { catalog, buffer: await mergePdfs(buffers) };
}

export async function getCatalogPreviewHtml(catalogId, { showGuides = false } = {}) {
  const catalog = await getCatalog(catalogId);
  return renderCatalogHtml(catalog, { mode: 'preview', showGuides });
}
