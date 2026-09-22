import { loadTestEnv } from './loadTestEnv.js';

const url = loadTestEnv();

process.env.NODE_ENV = 'test';
process.env.HAS_TEST_DB = url ? '1' : '';
process.env.DATABASE_URL = url || 'postgresql://invalid:invalid@localhost:1/none_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789abcdef';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
