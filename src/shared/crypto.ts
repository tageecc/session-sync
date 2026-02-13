/**
 * End-to-end encryption module.
 *
 * - Key derivation: PBKDF2 (600K iterations) → AES-256-GCM
 * - Sync key: system-generated 120-bit random key
 * - Server never has access to plaintext
 */

const PBKDF2_ITERATIONS = 600_000

/** Safe alphabet: excludes easily confused chars (0/O/1/I/L). 32 chars → 5 bits per char. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CHAR_SET = '[A-HJ-NP-Z2-9]'

/**
 * Generate a random sync key in XXXXXX-XXXXXX-XXXXXX-XXXXXX format.
 * 24 chars × 5 bits = 120 bits of entropy (exceeds NIST 112-bit minimum).
 */
export function generateSyncKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let raw = ''
  for (const byte of bytes) raw += ALPHABET[byte % 32]
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}-${raw.slice(18, 24)}`
}

/** Sync key format regex */
const SYNC_KEY_PATTERN = new RegExp(`^${CHAR_SET}{6}-${CHAR_SET}{6}-${CHAR_SET}{6}-${CHAR_SET}{6}$`)

/** Validate sync key format */
export function isValidSyncKey(key: string): boolean {
  return SYNC_KEY_PATTERN.test(key.toUpperCase())
}

/** Derive a user identifier (SHA-256 hash) from the key, used for DB lookups */
export async function deriveUserHash(passphrase: string): Promise<string> {
  const data = new TextEncoder().encode(passphrase)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return hexEncode(new Uint8Array(hash))
}

/**
 * Derive a write token from the key (different hash than user_hash).
 * Used to authorize write/update operations.
 * Knowing user_hash does NOT reveal write_token.
 */
export async function deriveWriteToken(passphrase: string): Promise<string> {
  const data = new TextEncoder().encode('session-sync:write:' + passphrase)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return hexEncode(new Uint8Array(hash))
}

// ── Encryption / Decryption ─────────────────────────────────────

export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ciphertext: string
  /** Base64-encoded initialization vector */
  iv: string
  /** Base64-encoded salt */
  salt: string
}

/** Encrypt any JSON-serializable data */
export async function encrypt(data: unknown, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)

  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  }
}

/** Decrypt data, returning the original JSON object */
export async function decrypt<T = unknown>(
  payload: EncryptedPayload,
  passphrase: string,
): Promise<T> {
  const salt = fromBase64(payload.salt)
  const iv = fromBase64(payload.iv)
  const ciphertext = fromBase64(payload.ciphertext)

  const key = await deriveKey(passphrase, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  )

  return JSON.parse(new TextDecoder().decode(decrypted))
}

// ── Internal helpers ────────────────────────────────────────────

/** Derive an AES-256-GCM key from passphrase + salt via PBKDF2 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
