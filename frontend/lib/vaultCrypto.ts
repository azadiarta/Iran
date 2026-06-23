// Real end-to-end decryption (WebCrypto `crypto.subtle`, not obfuscation) for
// the superuser-only password vault (see backend/pwvault/transport.py for the
// matching server-side half of this exchange).
//
// Every reveal generates a fresh, single-use P-256 ECDH keypair right here in
// the browser. Only the public half ever leaves the browser (as the `epk`
// query param); the private half never leaves `window` memory and is
// discarded once the caller is done with it. The server does the same on its
// side, so the AES-256-GCM keys that actually protect the response are
// derived (HKDF-SHA256) from a shared secret that exists nowhere on the wire
// in any form -- recovering it from a network capture means solving the
// elliptic-curve discrete-log problem, not just grabbing some bytes.
//
// Because both ephemeral keypairs are single-use and never persisted, this
// also gives Perfect Forward Secrecy: even a later full compromise of the
// server's long-term vault key does not help decrypt a reveal that already
// happened.
//
// Honest limitation (unchanged from this module's previous revision): anyone
// with full access to the same logged-in superuser browser session (e.g. its
// devtools console, mid-reveal) could call these functions directly. This
// layer defeats passive network/proxy snooping and protects past reveals
// even after a future key compromise -- it is not meant to withstand someone
// who already controls the superuser's own live session.

const EC_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

export interface VaultEnvelope {
  server_epk: string;
  salt: string;
  nonce1: string;
  nonce2: string;
  ciphertext: string;
}

export interface VaultHistoryEntryEnvelope {
  sequence: number;
  created_at: string;
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

async function deriveSharedSecretKeys(
  privateKey: CryptoKey,
  serverEpkB64: string,
  saltB64: string,
  memberId: string
): Promise<{ key1: CryptoKey; key2: CryptoKey; aad: Uint8Array<ArrayBuffer> }> {
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
  return { key1, key2, aad: utf8ToBytes(memberId) };
}

async function decryptLayers(
  key1: CryptoKey,
  key2: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  envelope: { nonce1: string; nonce2: string; ciphertext: string }
): Promise<string> {
  const ct1 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce2), additionalData: aad },
    key2,
    b64ToBytes(envelope.ciphertext)
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce1), additionalData: aad },
    key1,
    ct1
  );
  return new TextDecoder().decode(plain);
}

// Mirrors pwvault/transport.py's encrypt_for_transport_e2e(): one ECDH
// exchange (the server's ephemeral public key travels inside the envelope
// itself), then two nested AES-GCM layers, unwrapped outermost (layer-2)
// first.
export async function decryptVaultEnvelope(
  envelope: VaultEnvelope,
  privateKey: CryptoKey,
  memberId: string
): Promise<string> {
  const { key1, key2, aad } = await deriveSharedSecretKeys(privateKey, envelope.server_epk, envelope.salt, memberId);
  return decryptLayers(key1, key2, aad, envelope);
}

// Mirrors pwvault/transport.py's encrypt_many_for_transport_e2e(): a single
// ECDH exchange (and HKDF salt) shared across every history entry, each with
// its own unique nonces.
export async function decryptVaultHistory(
  serverEpk: string,
  salt: string,
  entries: VaultHistoryEntryEnvelope[],
  privateKey: CryptoKey,
  memberId: string
): Promise<{ sequence: number; created_at: string; password: string }[]> {
  const { key1, key2, aad } = await deriveSharedSecretKeys(privateKey, serverEpk, salt, memberId);
  return Promise.all(
    entries.map(async (entry) => ({
      sequence: entry.sequence,
      created_at: entry.created_at,
      password: await decryptLayers(key1, key2, aad, entry),
    }))
  );
}
