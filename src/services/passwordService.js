import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Hash de referencia para igualar el tiempo de respuesta cuando el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync('pdfcatalogo-dummy-password', SALT_ROUNDS);

export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash || DUMMY_HASH);
