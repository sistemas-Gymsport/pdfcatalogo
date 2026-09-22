import * as userService from '../services/userService.js';
import { sendSuccess } from '../utils/response.js';

export async function list(_req, res) {
  sendSuccess(res, await userService.listUsers());
}

export async function create(req, res) {
  sendSuccess(res, await userService.createUser(req.valid.body), 201);
}

export async function updateStatus(req, res) {
  sendSuccess(res, await userService.updateUserStatus(req.user.id, req.valid.params.id, req.valid.body.status));
}
