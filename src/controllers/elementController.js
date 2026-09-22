import * as elementService from '../services/elementService.js';
import { sendMessage, sendSuccess } from '../utils/response.js';

export async function create(req, res) {
  sendSuccess(res, await elementService.createElement(req.valid.params.id, req.valid.body), 201);
}

export async function get(req, res) {
  sendSuccess(res, await elementService.getElement(req.valid.params.id));
}

export async function update(req, res) {
  sendSuccess(res, await elementService.updateElement(req.valid.params.id, req.valid.body));
}

export async function remove(req, res) {
  await elementService.deleteElement(req.valid.params.id);
  sendMessage(res, 'Elemento eliminado');
}
