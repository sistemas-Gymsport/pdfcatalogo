import * as pdfService from '../services/pdfService.js';
import { slugify } from '../utils/strings.js';

export async function download(req, res) {
  const { catalog, buffer } = await pdfService.generateCatalogPdf(req.valid.params.id);
  const disposition = req.valid.query.disposition === 'inline' ? 'inline' : 'attachment';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `${disposition}; filename="${slugify(catalog.name)}.pdf"`,
    'Cache-Control': 'no-store',
  });
  res.send(buffer);
}

/** HTML exacto que se convierte en PDF (usado por la vista previa). */
export async function previewHtml(req, res) {
  const html = await pdfService.getCatalogPreviewHtml(req.valid.params.id, { showGuides: req.valid.query.guides });
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.send(html);
}
