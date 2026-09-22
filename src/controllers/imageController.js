import * as imageService from '../services/imageService.js';
import { uploadImageSchema } from '../validators/imageValidators.js';
import { sendSuccess } from '../utils/response.js';

export async function list(req, res) {
  sendSuccess(res, await imageService.listImages(req.valid.query));
}

export async function get(req, res) {
  sendSuccess(res, await imageService.getImage(req.valid.params.id));
}

/** multipart/form-data: file + name + description (se valida después de multer). */
export async function upload(req, res) {
  const meta = uploadImageSchema.parse(req.body ?? {});
  sendSuccess(res, await imageService.uploadImage(req.file, meta, req.user.id), 201);
}

export async function update(req, res) {
  sendSuccess(res, await imageService.updateImage(req.valid.params.id, req.valid.body));
}

export async function remove(req, res) {
  sendSuccess(res, await imageService.deleteImage(req.valid.params.id));
}
