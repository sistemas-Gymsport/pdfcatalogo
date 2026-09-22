import * as catalogService from '../services/catalogService.js';
import * as documentService from '../services/documentService.js';
import { sendMessage, sendSuccess } from '../utils/response.js';

export async function list(req, res) {
  sendSuccess(res, await catalogService.listCatalogs(req.valid.query));
}

export async function get(req, res) {
  sendSuccess(res, await catalogService.getCatalog(req.valid.params.id));
}

export async function create(req, res) {
  sendSuccess(res, await catalogService.createCatalog(req.valid.body, req.user.id), 201);
}

export async function update(req, res) {
  sendSuccess(res, await catalogService.updateCatalog(req.valid.params.id, req.valid.body));
}

export async function remove(req, res) {
  await catalogService.deleteCatalog(req.valid.params.id);
  sendMessage(res, 'Catálogo eliminado');
}

export async function duplicate(req, res) {
  sendSuccess(res, await catalogService.duplicateCatalog(req.valid.params.id, req.user.id), 201);
}

export async function saveDocument(req, res) {
  sendSuccess(res, await documentService.saveDocument(req.valid.params.id, req.valid.body));
}

export async function stats(_req, res) {
  sendSuccess(res, await catalogService.getStats());
}
