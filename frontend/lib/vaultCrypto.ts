// Real end-to-end decryption (WebCrypto `crypto.subtle`, not obfuscation) for
// the superuser-only password vault (see backend/pwvault/transport.py for the
// matching server-side half of this exchange).
//
// Two independent layers protect every response, strongest/newest outermost
// -- mirroring backend/pwvault/crypto.py's at-rest combination:
//
//   1. ECDH layer (outermost, peeled off first): every reveal generates a
//      fresh, single-use P-256 ECDH keypair right here in the browser. Only
//      the public half ever leaves the browser (the `epk` query param); the
//      private half never leaves `window` memory and is discarded once the
//      caller is done with it. The server does the same on its side, so the
//      AES-256-GCM keys that protect this layer are derived (HKDF-SHA256)
//      from a shared secret that exists nowhere on the wire in any form --
//      recovering it from a network capture means solving the elliptic-curve
//      discrete-log problem, not just grabbing some bytes. Because both
//      ephemeral keypairs are single-use and never persisted, this also
//      gives Perfect Forward Secrecy: even a later full compromise of the
//      server's long-term keys does not help decrypt a reveal that already
//      happened.
//
//   2. Token-bound layer (innermost, peeled off second): two more AES-256-GCM
//      keys, HKDF-derived from this browser's own current access token --
//      the very token that authenticated the HTTP request in the first
//      place (see lib/api.ts / store/authStore.ts). That token never travels
//      alongside the ciphertext, so even a captured response that somehow
//      got layer 1 peeled off is still opaque without it.
//
// Honest limitation (unchanged from this module's previous revisions):
// anyone with full access to the same logged-in superuser browser session
// (e.g. its devtools console, mid-reveal) could call these functions
// directly, since both the ephemeral private key and the access token live
// in this session's memory/storage. This layer defeats passive
// network/proxy snooping and protects past reveals even after a future key
// compromise -- it is not meant to withstand someone who already controls
// the superuser's own live session.

const EC_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

export interface VaultEnvelope {
  server_epk: string;
  salt: string;
  jwt_salt1: string;
  jwt_nonce1: string;
  jwt_salt2: string;
  jwt_nonce2: string;
  nonce1: string;
  nonce2: string;
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
  ciphertext: string;
}

export interface EphemeralKeyPair {
  privateKey: CryptoKey;
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

// One fresh ephemeral keypair per reveal — call this right before requesting
// the envelope, and discard the result once decryption is done.
export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits']);
  const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  return { privateKey: keyPair.privateKey, publicKeyB64: bytesToB64(rawPublicKey) };
}

// ─── Layer 1 (outermost on the wire, peeled off first) — ECDH + double
// AES-256-GCM, mirrors pwvault/transport.py's encrypt_*_for_transport_e2e().
async function deriveEcdhLayerKeys(
  privateKey: CryptoKey,
  serverEpkB64: string,
  saltB64: string
): Promise<{ key1: CryptoKey; key2: CryptoKey }> {
  const serverPublicKey = await crypto.subtle.importKey('raw', b64ToBytes(serverEpkB64), EC_PARAMS, false, []);
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPublicKey } as EcdhKeyDeriveParams,
    privateKey,
    256
  );
  const sharedSecretKeyMaterial = await crypto.subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveKey']);

  const salt = b64ToBytes(saltB64);
  const deriveLayerKey = (info: string) =>
    crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: utf8ToBytes(info) },
      sharedSecretKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

  const [key1, key2] = await Promise.all([
    deriveLayerKey('pwvault-e2e-layer-1'),
    deriveLayerKey('pwvault-e2e-layer-2'),
  ]);
  return { key1, key2 };
}

async function decryptEcdhLayer(
  key1: CryptoKey,
  key2: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  envelope: { nonce1: string; nonce2: string; ciphertext: string }
): Promise<ArrayBuffer> {
  const ct1 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce2), additionalData: aad },
    key2,
    b64ToBytes(envelope.ciphertext)
  );
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce1), additionalData: aad },
    key1,
    ct1
  );
}

// ─── Layer 2 (innermost on the wire, peeled off second) — access-token-bound
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

export async function decryptVaultEnvelope(
  envelope: VaultEnvelope,
  privateKey: CryptoKey,
  memberId: string,
  accessToken: string
): Promise<string> {
  const aad = utf8ToBytes(memberId);
  const { key1, key2 } = await deriveEcdhLayerKeys(privateKey, envelope.server_epk, envelope.salt);
  const ecdhUnwrapped = await decryptEcdhLayer(key1, key2, aad, envelope);
  return decryptTokenLayer(accessToken, aad, ecdhUnwrapped, envelope);
}

// Mirrors pwvault/transport.py's encrypt_many_for_transport_e2e(): a single
// ECDH exchange (and HKDF salt) shared across every history entry, each with
// its own unique token-layer salts/nonces and its own unique ECDH-layer
// nonces.
export async function decryptVaultHistory(
  serverEpk: string,
  salt: string,
  entries: VaultHistoryEntryEnvelope[],
  privateKey: CryptoKey,
  memberId: string,
  accessToken: string
): Promise<{ sequence: number; created_at: string; password: string }[]> {
  const aad = utf8ToBytes(memberId);
  const { key1, key2 } = await deriveEcdhLayerKeys(privateKey, serverEpk, salt);
  return Promise.all(
    entries.map(async (entry) => {
      const ecdhUnwrapped = await decryptEcdhLayer(key1, key2, aad, entry);
      return {
        sequence: entry.sequence,
        created_at: entry.created_at,
        password: await decryptTokenLayer(accessToken, aad, ecdhUnwrapped, entry),
      };
    })
  );
}
