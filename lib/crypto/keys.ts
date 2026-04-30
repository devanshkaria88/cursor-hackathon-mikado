// docs/architecture.md §Cryptographic signing + docs/backend.md §Crypto module
// Singleton Ed25519 keypair. Persisted to .keys/ on disk so it survives Next.js
// hot-reloads in dev (otherwise every restart invalidates previously-issued
// receipts, which would break the verify demo across reloads).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from 'node:crypto';

type Pair = { publicKey: KeyObject; privateKey: KeyObject };

const KEYS_DIR = join(process.cwd(), '.keys');
const PRIV_PATH = join(KEYS_DIR, 'mikado-ed25519.pem');
const PUB_PATH = join(KEYS_DIR, 'mikado-ed25519.pub.pem');

let cached: Pair | null = null;

function loadOrCreate(): Pair {
  if (cached) return cached;

  if (existsSync(PRIV_PATH) && existsSync(PUB_PATH)) {
    const privPem = readFileSync(PRIV_PATH, 'utf8');
    const pubPem = readFileSync(PUB_PATH, 'utf8');
    cached = {
      privateKey: createPrivateKey(privPem),
      publicKey: createPublicKey(pubPem),
    };
    return cached;
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(KEYS_DIR, { recursive: true });
  writeFileSync(
    PRIV_PATH,
    privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    { mode: 0o600 },
  );
  writeFileSync(
    PUB_PATH,
    publicKey.export({ type: 'spki', format: 'pem' }) as string,
  );
  cached = { publicKey, privateKey };
  return cached;
}

export function getPublicKey(): string {
  return loadOrCreate()
    .publicKey.export({ type: 'spki', format: 'pem' })
    .toString();
}

export function getPrivateKey(): KeyObject {
  return loadOrCreate().privateKey;
}
