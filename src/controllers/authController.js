import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { sendMessage, sendSuccess } from '../utils/response.js';

export async function login(req, res) {
  sendSuccess(res, await authService.login(req.valid.body));
}

export async function me(req, res) {
  sendSuccess(res, await authService.getProfile(req.user.id));
}

/** JWT sin estado: el cliente descarta el token. Se deja el endpoint para futuras listas de revocación. */
export function logout(_req, res) {
  sendMessage(res, 'Sesión cerrada');
}

export async function changePassword(req, res) {
  await userService.changePassword(req.user.id, req.valid.body);
  sendMessage(res, 'Contraseña actualizada');
}
