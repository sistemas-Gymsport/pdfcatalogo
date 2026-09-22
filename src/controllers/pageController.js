import * as pageService from '../services/pageService.js';
import { sendMessage, sendSuccess } from '../utils/response.js';

export async function list(req, res) {
  sendSuccess(res, await pageService.listPages(req.valid.params.id));
}

export async function create(req, res) {
  sendSuccess(res, await pageService.createPage(req.valid.params.id, req.valid.body), 201);
}

export async function reorder(req, res) {
  sendSuccess(res, await pageService.reorderPages(req.valid.params.id, req.valid.body.pageIds));
}

export async function get(req, res) {
  sendSuccess(res, await pageService.getPage(req.valid.params.id));
}

export async function update(req, res) {
  sendSuccess(res, await pageService.updatePage(req.valid.params.id, req.valid.body));
}

export async function remove(req, res) {
  await pageService.deletePage(req.valid.params.id);
  sendMessage(res, 'Página eliminada');
}

export async function duplicate(req, res) {
  sendSuccess(res, await pageService.duplicatePage(req.valid.params.id), 201);
}
