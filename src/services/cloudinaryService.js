import { v2 as cloudinary } from 'cloudinary';
import { env, isCloudinaryConfigured } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let configured = false;

function getClient() {
  if (!isCloudinaryConfigured()) {
    throw AppError.serviceUnavailable(
      'Cloudinary no está configurado en el servidor. Revisa las variables CLOUDINARY_*',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

function providerError(error) {
  console.error('[cloudinary]', error?.message || error);
  return new AppError('No se pudo comunicar con Cloudinary. Intenta nuevamente.', 502, 'CLOUDINARY_ERROR');
}

/** Sube un buffer a Cloudinary sin tocar el disco. */
export function uploadBuffer(buffer) {
  const client = getClient();
  return new Promise((resolve, reject) => {
    try {
      const stream = client.uploader.upload_stream(
        { folder: env.cloudinary.folder, resource_type: 'image', unique_filename: true },
        (error, result) => (error ? reject(providerError(error)) : resolve(result)),
      );
      stream.end(buffer);
    } catch (error) {
      reject(providerError(error));
    }
  });
}

/** Elimina un recurso. "not found" se considera éxito (ya no existe). */
export async function destroyAsset(publicId) {
  const client = getClient();
  try {
    const result = await client.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (result?.result !== 'ok' && result?.result !== 'not found') {
      throw new Error(`Respuesta inesperada: ${JSON.stringify(result)}`);
    }
    return result.result;
  } catch (error) {
    throw error instanceof AppError ? error : providerError(error);
  }
}
