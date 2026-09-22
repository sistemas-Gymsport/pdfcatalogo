import { describe, it, expect } from 'vitest';
import { renderCatalogHtml, styleToCss } from '../src/renderer/renderCatalogHtml.js';
import { elementContentStyles, resolveColor } from '../src/shared/renderModel.js';
import { printImageUrl } from '../src/renderer/printImages.js';

const baseCatalog = {
  name: 'Prueba <b>',
  pageWidth: 148,
  pageHeight: 297,
  marginTop: 10,
  marginBottom: 12,
  marginLeft: 8,
  marginRight: 9,
  colorPrimary: '#F64851',
  colorSecondary: '#1F2937',
  colorText: '#111827',
  colorBackground: '#FFFFFF',
};

const el = (overrides) => ({ id: 'e1', type: 'text', x: 10, y: 20, width: 50, height: 15, zIndex: 1, ...overrides });

describe('Renderer HTML', () => {
  it('define @page con el tamaño físico en mm y margen 0', () => {
    const html = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [] }] });
    expect(html).toContain('@page{size:148mm 297mm;margin:0}');
    expect(html).toMatch(/class="page"[^>]*width:148mm;height:297mm/);
  });

  it('posiciona elementos en mm y respeta rotación, capa y tipografía (pt)', () => {
    const html = renderCatalogHtml({
      ...baseCatalog,
      pages: [{ elements: [el({ rotation: 15, zIndex: 3, fontSize: 18, fontFamily: 'Montserrat', fontWeight: 700, content: 'Hola' })] }],
    });
    expect(html).toContain('left:10mm;top:20mm;width:50mm;height:15mm;z-index:3');
    expect(html).toContain('transform:rotate(15deg)');
    expect(html).toContain('font-size:18pt');
    expect(html).toContain('font-family:&#39;Montserrat&#39;, sans-serif');
    expect(html).toContain('family=Montserrat');
  });

  it('usa variables CSS para los colores del catálogo', () => {
    const html = renderCatalogHtml({ ...baseCatalog, pages: [{ backgroundColor: 'secondary', elements: [el({ color: 'primary' })] }] });
    expect(html).toContain('--color-primary:#F64851');
    expect(html).toContain('color:var(--color-primary)');
    expect(html).toContain('background-color:var(--color-secondary)');
  });

  it('escapa el contenido (sin inyección de HTML)', () => {
    const html = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [el({ content: '<script>alert(1)</script>' })] }] });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<title>Prueba &lt;b&gt;</title>');
  });

  it('omite elementos ocultos y ordena por zIndex', () => {
    const html = renderCatalogHtml({
      ...baseCatalog,
      pages: [{ elements: [el({ id: 'top', zIndex: 5 }), el({ id: 'hidden', hidden: true }), el({ id: 'bottom', zIndex: 0 })] }],
    });
    expect(html).not.toContain('data-id="hidden"');
    expect(html.indexOf('data-id="bottom"')).toBeLessThan(html.indexOf('data-id="top"'));
  });

  it('renderiza imagen, línea y rectángulo', () => {
    const html = renderCatalogHtml({
      ...baseCatalog,
      pages: [
        {
          elements: [
            el({ id: 'img', type: 'image', objectFit: 'contain', image: { url: 'https://res.cloudinary.com/x/a.jpg', name: 'A' } }),
            el({ id: 'line', type: 'line', borderWidth: 0.8, borderStyle: 'dashed', color: '#000000' }),
            el({ id: 'rect', type: 'rectangle', backgroundColor: 'primary', borderRadius: 3 }),
          ],
        },
      ],
    });
    expect(html).toContain('src="https://res.cloudinary.com/x/a.jpg"');
    expect(html).toContain('object-fit:contain');
    expect(html).toContain('border-top:0.8mm dashed #000000');
    expect(html).toContain('border-radius:3mm');
  });

  it('una sección por página con salto de página', () => {
    const html = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [] }, { elements: [] }, { elements: [] }] });
    expect(html.match(/<section class="page"/g)).toHaveLength(3);
    expect(html).toContain('break-after:page');
  });

  it('guías de márgenes solo en vista previa y ocultas al imprimir', () => {
    const preview = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [] }] }, { mode: 'preview', showGuides: true });
    expect(preview).toContain('class="margin-guides" style="position:absolute;left:8mm;top:10mm;right:9mm;bottom:12mm"');
    expect(preview).toContain('@media print{.page-label,.margin-guides{display:none!important}}');
    const print = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [] }] });
    expect(print).not.toContain('class="margin-guides"');
  });
});

describe('Imágenes a resolución de impresión (300 ppp)', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/pdfcatalogo/foto.jpg';

  it('pide a Cloudinary exactamente los píxeles del recuadro a 300 ppp', () => {
    // 100 mm = 3.937 in × 300 = 1182 px ; 50 mm → 591 px
    expect(printImageUrl(url, { width: 100, height: 50, objectFit: 'cover' })).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_lfill,w_1182,h_591,q_auto:best/v1/pdfcatalogo/foto.jpg',
    );
    expect(printImageUrl(url, { width: 100, height: 50, objectFit: 'contain' })).toContain('/c_limit,w_1182,h_591,');
  });

  it('no modifica URLs que no son de Cloudinary', () => {
    expect(printImageUrl('http://localhost/a.png', { width: 10, height: 10 })).toBe('http://localhost/a.png');
  });

  it('el HTML del PDF usa la URL de impresión', () => {
    const html = renderCatalogHtml({ ...baseCatalog, pages: [{ elements: [el({ type: 'image', width: 100, height: 50, image: { url } })] }] });
    expect(html).toContain('c_lfill,w_1182,h_591');
  });
});

describe('Modelo compartido', () => {
  it('resuelve tokens y colores', () => {
    expect(resolveColor('primary')).toBe('var(--color-primary)');
    expect(resolveColor('#ABCDEF')).toBe('#ABCDEF');
    expect(resolveColor(null, 'text')).toBe('var(--color-text)');
    expect(resolveColor(null)).toBeUndefined();
  });

  it('alineación vertical del texto', () => {
    const { content } = elementContentStyles(el({ verticalAlign: 'bottom' }));
    expect(content.justifyContent).toBe('flex-end');
  });

  it('styleToCss convierte camelCase y omite vacíos', () => {
    expect(styleToCss({ fontSize: '12pt', color: undefined, '--x': 'y' })).toBe('font-size:12pt;--x:y');
  });
});
