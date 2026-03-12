import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

const prisma = new PrismaClient();
const agencySlug = (process.env.AGENCY_ORG_SLUG || 'inovacortex').toLowerCase();
const appKey = process.env.APP_ENCRYPTION_KEY;
if (!appKey) {
  throw new Error('APP_ENCRYPTION_KEY missing');
}

const user = await prisma.user.findFirst({
  where: { organization: { slug: agencySlug } },
  include: { organization: { select: { id: true, slug: true } } },
  orderBy: { createdAt: 'asc' }
});

if (!user) {
  throw new Error(`No user found for org slug ${agencySlug}`);
}

const roleRaw = String(user.role || '').toLowerCase();
const allowed = new Set(['owner','admin','closer','viewer']);
const role = allowed.has(roleRaw) ? roleRaw : 'admin';

const token = await new SignJWT({
  userId: user.id,
  orgId: user.organizationId,
  orgSlug: user.organization.slug,
  role,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(new TextEncoder().encode(appKey));

const out = {
  orgSlug: user.organization.slug,
  userId: user.id,
  role,
  token,
};

fs.writeFileSync('.tmp/session.json', JSON.stringify(out, null, 2), 'utf8');
console.log('session_written:.tmp/session.json');
await prisma.$disconnect();
