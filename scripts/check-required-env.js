#!/usr/bin/env node

require('dotenv').config();

const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'APP_ENCRYPTION_KEY',
  'NEXT_PUBLIC_BASE_URL',
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('[ENV CHECK FAILED] Missing required environment variables:');
  missing.forEach((key) => console.error(` - ${key}`));
  console.error('Set these variables in .env.local / .env / CI secrets before running tests.');
  process.exit(1);
}

console.log('[ENV CHECK PASSED] All required env vars are set.');
process.exit(0);
