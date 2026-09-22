import path from 'node:path';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { uploadBuffer, destroyAsset } from './cloudinaryService.js';

const withUsage = { _count: { select: { elements: true } } };

function serializeImage({ _count, ...image }) {
  return { ...image, usageCount: _count?.elements ?? 0 };
}

export async function listImages({ search = '' } = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;
  const images = await prisma.image.findMany({ where, orderBy: { createdAt: 'desc' }, include: withUsage });
  return images.map(serializeImage);
}

export async function getImage(id) {
  const image = await prisma.image.findUnique({ where: { id }, include: withUsage });
  if (!image) throw AppError.notFound('Imagen no encontrada', 'IMAGE_NOT_FOUND');
  return serializeImage(image);
}

function defaultName(originalName) {
  const base = path.parse(originalName || '').name.replace(/[-_]+/g, ' ').trim();
  return (base || 'Imagen').slice(0, 120);
}

/** Sube a Cloudinary y registra los metadatos. Si falla la BD, se borra de Cloudinary. */
export async function uploadImage(file, { name, description }, userId) {
  if (!file) throw AppError.badRequest('Selecciona una imagen para subir', 'FILE_REQUIRED');

  const result = await uploadBuffer(file.buffer);
  try {
    const image = await prisma.image.create({
      data: {
        name: name || defaultName(file.originalname),
        description,
        url: result.secure_url,
        publicId: result.public_id,
        width: Math.round(result.width || 0),
        height: Math.round(result.height || 0),
        format: result.format || null,
        bytes: result.bytes ?? file.size,
        uploadedById: userId,
      },
      include: withUsage,
    });
    return serializeImage(image);
  } catch (error) {
    await destroyAsset(result.public_id).catch(() => {});
    throw error;
  }
}

export async function updateImage(id, data) {
  await getImage(id);
  const image = await prisma.image.update({ where: { id }, data, include: withUsage });
  return serializeImage(image);
}

/** Catálogos y páginas donde se usa una imagen. */
export async function getImageUsage(id) {
  const elements = await prisma.pageElement.findMany({
    where: { imageId: id },
    select: { page: { select: { order: true, catalog: { select: { id: true, name: true } } } } },
  });
  const byCatalog = new Map();
  for (const { page } of elements) {
    const entry = byCatalog.get(page.catalog.id) || { id: page.catalog.id, name: page.catalog.name, pages: new Set() };
    entry.pages.add(page.order + 1);
    byCatalog.set(page.catalog.id, entry);
  }
  return [...byCatalog.values()].map((c) => ({ ...c, pages: [...c.pages].sort((a, b) => a - b) }));
}

/**
 * Elimina la imagen de la BD y de Cloudinary.
 * - Si algún catálogo la usa, NO se elimina (409 IMAGE_IN_USE): borrarla dejaría
 *   huecos en catálogos existentes. Primero hay que quitarla o cambiarla en el editor.
 * - Se borra el registro dentro de una transacción y solo se confirma si Cloudinary
 *   también la eliminó; si Cloudinary falla, el registro se conserva intacto.
 */
export async function deleteImage(id) {
  const image = await getImage(id);
  const usage = await getImageUsage(id);
  if (usage.length) {
    const list = usage.map((c) => `"${c.name}" (pág. ${c.pages.join(', ')})`).join(', ');
    throw new AppError(
      `La imagen se está usando en ${list}. Quítala o cámbiala en el editor antes de eliminarla.`,
      409,
      'IMAGE_IN_USE',
      usage,
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.image.delete({ where: { id } });
      await destroyAsset(image.publicId);
    },
    { timeout: 30000 },
  );
  return { id };
}
