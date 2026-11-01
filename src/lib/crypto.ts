import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * Cifrado simetrico para credenciales sensibles (API Keys de IA, tokens de
 * redes sociales). AES-256-GCM con IV aleatorio por registro.
 *
 * Formato del valor almacenado:  v1:<iv-hex>:<tag-hex>:<ciphertext-hex>
 */

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno ENCRYPTION_KEY. Generá una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Acepta hex de 64 caracteres, base64 o cualquier string (se deriva con SHA-256).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    /* no es base64 valido, se deriva */
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(`${VERSION}:`)) return '';
  const [, ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  try {
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return '';
  }
}

/** Devuelve una version enmascarada para mostrar en el panel: sk-...9f2a */
export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 8) return '••••••••';
  return `${plain.slice(0, 4)}${'•'.repeat(8)}${plain.slice(-4)}`;
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
