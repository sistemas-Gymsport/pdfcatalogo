import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Tu sesión expiró. Inicia sesión nuevamente', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Sesión inválida', 'TOKEN_INVALID');
  }
}
