// Real end-to-end decryption (WebCrypto `crypto.subtle` + audited pure-JS
// fallbacks for the one primitive WebCrypto doesn't ship, never obfuscation)
// for the superuser-only password vault (see backend/pwvault/transport.py
// for the matching server-side half of this exchange).
//
// Three independent layers protect every response, strongest/newest
// outermost -- mirroring backend/pwvault/crypto.py's at-rest combination:
//
//   1. ML-KEM-768 layer (outermost, peeled off first): every reveal
//      generates a fresh, single-use ML-KEM-768 keypair (FIPS 203, the
//      NIST-standardized post-quantum key-encapsulation mechanism; this
//      module uses @noble/post-quantum, the server uses cryptography's
//      native `mlkem` module -- both interoperable) right here in the
//      browser. Only the public half ever leaves the browser (`kem_pk`);
//      the secret half never leaves memory. Plain ECDH (layer 2 below) is
//      only as hard as the elliptic-curve discrete-log problem, which a
//      sufficiently capable quantum computer breaks outright (Shor's
//      algorithm) -- an adversary recording today's traffic could decrypt
//      it once such a machine exists ("harvest now, decrypt later"). This
//      layer closes exactly that gap, independently of layer 2: breaking
//      one does not help break the other.
//
//   2. ECDH layer (middle): a fresh, single-use P-256 ECDH keypair, same
//      construction as before this layer existed. The AES-256-GCM keys
//      that protect it are HKDF-derived from a shared secret that exists
//      nowhere on the wire in any form. Both ephemeral keypairs (this one
//      and the ML-KEM one above) are discarded once the caller is done,
//      giving Perfect Forward Secrecy: even a later full compromise of the
//      server's long-term keys does not help decrypt a reveal that already
//      happened.
//
//   3. Token-bound layer (innermost, peeled off last): two more
//      AES-256-GCM keys, HKDF-derived from this browser's own current
//      access token -- the very token that authenticated the HTTP request
//      in the first place (see lib/api.ts / store/authStore.ts). That token
//      never travels alongside the ciphertext, so even a captured response
//      that somehow got layers 1 and 2 peeled off is still opaque without it.
//
// A captured response must therefore survive breaking three independent
// hard problems from three different mathematical families at once -- or
// holding one of two ephemeral private keys that never leave the browser,
// plus the exact JWT that authenticated the original request -- to recover
// anything.
//
// Honest limitation (unchanged from this module's previous revisions):
// anyone with full access to the same logged-in superuser browser session
// (e.g. its devtools console, mid-reveal) could call these functions
// directly, since the ephemeral private keys and the access token all live
// in this session's memory/storage. These layers defeat passive
// network/proxy snooping and protect past reveals even after a future key
// compromise -- they are not meant to withstand someone who already
// controls the superuser's own live session.

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

const EC_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

export interface VaultEnvelope {
  server_epk: string;
  salt: string;
  pq_ciphertext: string;
  pq_salt: string;
  jwt_salt1: string;
  jwt_nonce1: string;
  jwt_salt2: string;
  jwt_nonce2: string;
  nonce1: string;
  nonce2: string;
  pq_nonce: string;
  ciphertext: string;
}

export interface VaultHistoryEntryEnvelope {
  sequence: number;
  created_at: string;
  jwt_salt1: string;
  jwt_nonce1: string;
  jwt_salt2: string;
  jwt_nonce2: string;
  nonce1: string;
  nonce2: string;
  pq_nonce: string;
  ciphertext: string;
}

export interface EphemeralKeyPair {
  privateKey: CryptoKey;
  publicKeyB64: string;
}

export interface EphemeralKemKeyPair {
  secretKey: Uint8Array;
  publicKeyB64: string;
}

// TS's BufferSource type requires an ArrayBuffer-backed view, not just any
// Uint8Array — copying through `new Uint8Array(n)` guarantees a fresh,
// non-shared backing buffer that satisfies it.
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function utf8ToBytes(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

// One fresh ephemeral ECDH keypair per reveal — call this right before
// requesting the envelope, and discard the result once decryption is done.
export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  return { privateKey: keyPair.privateKey, publicKeyB64: bytesToB64(rawPublicKey) };
}

// One fresh ephemeral ML-KEM-768 keypair per reveal — the post-quantum
// counterpart to generateEphemeralKeyPair() above (see module docstring,
// layer 1). ml_kem768.keygen() is synchronous, unlike WebCrypto's API.
export function generateEphemeralKemKeyPair(): EphemeralKemKeyPair {
  const { secretKey, publicKey } = ml_kem768.keygen();
  return { secretKey, publicKeyB64: bytesToB64(publicKey) };
}

// ─── Layer 1 (outermost on the wire, peeled off first) — ML-KEM-768 +
// ChaCha20-Poly1305, mirrors pwvault/transport.py's layer 3.
// `new Uint8Array(...)` copies into a fresh, plain-ArrayBuffer-backed view --
// @noble's return type is the looser `Uint8Array<ArrayBufferLike>`, which
// WebCrypto's BufferSource-typed parameters below don't accept directly.
async function pqSharedSecret(kemSecretKey: Uint8Array, pqCiphertextB64: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(ml_kem768.decapsulate(b64ToBytes(pqCiphertextB64), kemSecretKey));
}

// crypto.subtle has no ChaCha20-Poly1305 support, so the key itself must be
// raw bytes (via deriveBits, not deriveKey) to hand to @noble/ciphers below.
async function derivePqEntryKey(
  pqSecret: Uint8Array<ArrayBuffer>,
  pqSaltB64: string,
  entryId: number | string
): Promise<Uint8Array<ArrayBuffer>> {
  const keyMaterial = await crypto.subtle.importKey('raw', pqSecret, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: b64ToBytes(pqSaltB64),
      info: utf8ToBytes(`pwvault-pq-layer-3:${entryId}`),
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function decryptPqLayer(
  pqKey: Uint8Array,
  aad: Uint8Array<ArrayBuffer>,
  pqNonceB64: string,
  ciphertextB64: string
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(chacha20poly1305(pqKey, b64ToBytes(pqNonceB64), aad).decrypt(b64ToBytes(ciphertextB64)));
}

// ─── Layer 2 (middle) — ECDH + double AES-256-GCM, mirrors
// pwvault/transport.py's layer 2. The ECDH exchange itself runs once per
// response (it's shared across every entry); only the cheap HKDF expand
// below runs per entry.
async function ecdhSharedSecretMaterial(privateKey: CryptoKey, serverEpkB64: string): Promise<CryptoKey> {
  const serverPublicKey = await crypto.subtle.importKey('raw', b64ToBytes(serverEpkB64), EC_PARAMS, false, []);
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPublicKey } as EcdhKeyDeriveParams,
    privateKey,
    256
  );
  return crypto.subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveKey']);
}

async function deriveEcdhEntryKeys(
  sharedSecretMaterial: CryptoKey,
  saltB64: string,
  entryId: number | string
): Promise<{ key1: CryptoKey; key2: CryptoKey }> {
  const salt = b64ToBytes(saltB64);
  const deriveLayerKey = (info: string) =>
    crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: utf8ToBytes(info) },
      sharedSecretMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  const [key1, key2] = await Promise.all([
    deriveLayerKey(`pwvault-e2e-layer-1:${entryId}`),
    deriveLayerKey(`pwvault-e2e-layer-2:${entryId}`),
  ]);
  return { key1, key2 };
}

async function decryptEcdhLayer(
  key1: CryptoKey,
  key2: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  nonce1B64: string,
  nonce2B64: string,
  ct2: Uint8Array<ArrayBuffer>
): Promise<ArrayBuffer> {
  const ct1 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(nonce2B64), additionalData: aad }, key2, ct2);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(nonce1B64), additionalData: aad }, key1, ct1);
}

// ─── Layer 3 (innermost on the wire, peeled off last) — access-token-bound
// double AES-256-GCM, mirrors pwvault/transport.py's _token_wrap().
async function deriveTokenLayerKey(
  tokenBytes: Uint8Array<ArrayBuffer>,
  saltB64: string,
  info: string
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', tokenBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: b64ToBytes(saltB64), info: utf8ToBytes(info) },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptTokenLayer(
  accessToken: string,
  aad: Uint8Array<ArrayBuffer>,
  ecdhUnwrapped: ArrayBuffer,
  envelope: { jwt_salt1: string; jwt_nonce1: string; jwt_salt2: string; jwt_nonce2: string }
): Promise<string> {
  const tokenBytes = utf8ToBytes(accessToken);
  const key2 = await deriveTokenLayerKey(tokenBytes, envelope.jwt_salt2, 'pwvault-transport-jwt-2');
  const ct1 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.jwt_nonce2), additionalData: aad },
    key2,
    ecdhUnwrapped
  );
  const key1 = await deriveTokenLayerKey(tokenBytes, envelope.jwt_salt1, 'pwvault-transport-jwt-1');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.jwt_nonce1), additionalData: aad },
    key1,
    ct1
  );
  return new TextDecoder().decode(plain);
}

// Single password reveal. `entryId` for both the PQ and ECDH layers is a
// fixed `0` here (and on the matching backend call in pwvault/views.py),
// since this path only ever encrypts exactly one entry — no list, so no
// position-vs-identity ambiguity to worry about.
export async function decryptVaultEnvelope(
  envelope: VaultEnvelope,
  privateKey: CryptoKey,
  kemSecretKey: Uint8Array,
  memberId: string,
  accessToken: string
): Promise<string> {
  const aad = utf8ToBytes(memberId);

  const pqSecret = await pqSharedSecret(kemSecretKey, envelope.pq_ciphertext);
  const pqKey = await derivePqEntryKey(pqSecret, envelope.pq_salt, 0);
  const ct2 = decryptPqLayer(pqKey, aad, envelope.pq_nonce, envelope.ciphertext);

  const sharedSecretMaterial = await ecdhSharedSecretMaterial(privateKey, envelope.server_epk);
  const { key1, key2 } = await deriveEcdhEntryKeys(sharedSecretMaterial, envelope.salt, 0);
  const ecdhUnwrapped = await decryptEcdhLayer(key1, key2, aad, envelope.nonce1, envelope.nonce2, ct2);

  return decryptTokenLayer(accessToken, aad, ecdhUnwrapped, envelope);
}

// Mirrors pwvault/transport.py's encrypt_many_for_transport_e2e(): a single
// ECDH exchange and a single ML-KEM-768 encapsulation, both shared across
// every history entry, but with every per-entry key derived using that
// entry's own stable `sequence` — never its position in this array. The
// backend already filters out undecryptable rows and reverses the list for
// newest-first display before this array ever reaches the browser; keying
// derivation off `entry.sequence` (carried in the envelope itself) instead
// of array position means neither operation can mix up which key belongs
// to which entry.
export async function decryptVaultHistory(
  serverEpk: string,
  salt: string,
  pqCiphertext: string,
  pqSalt: string,
  entries: VaultHistoryEntryEnvelope[],
  privateKey: CryptoKey,
  kemSecretKey: Uint8Array,
  memberId: string,
  accessToken: string
): Promise<{ sequence: number; created_at: string; password: string }[]> {
  const aad = utf8ToBytes(memberId);
  const pqSecret = await pqSharedSecret(kemSecretKey, pqCiphertext);
  const sharedSecretMaterial = await ecdhSharedSecretMaterial(privateKey, serverEpk);

  return Promise.all(
    entries.map(async (entry) => {
      const pqKey = await derivePqEntryKey(pqSecret, pqSalt, entry.sequence);
      const ct2 = decryptPqLayer(pqKey, aad, entry.pq_nonce, entry.ciphertext);

      const { key1, key2 } = await deriveEcdhEntryKeys(sharedSecretMaterial, salt, entry.sequence);
      const ecdhUnwrapped = await decryptEcdhLayer(key1, key2, aad, entry.nonce1, entry.nonce2, ct2);

      return {
        sequence: entry.sequence,
        created_at: entry.created_at,
        password: await decryptTokenLayer(accessToken, aad, ecdhUnwrapped, entry),
      };
    })
  );
}
