// Real client-side decryption (WebCrypto `crypto.subtle`, not obfuscation) for
// the superuser-only password vault (see backend/pwvault/transport.py for the
// matching encryption side). The shared secret is the superuser's own JWT
// access token — it is never sent alongside the envelope, so capturing the
// response body alone is not enough to derive the AES-GCM keys below.
//
// Honest limitation: anyone with full access to the same logged-in superuser
// browser session (e.g. its localStorage / devtools console) already holds
// that access token, so they could call this function directly. This layer
// is meant to defeat passive network/proxy snooping, not someone who already
// controls the superuser's own session.
export interface VaultEnvelope {
  salt1: string;
  nonce1: string;
  salt2: string;
  nonce2: string;
  ciphertext: string;
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

function utf8ToBytes(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

async function deriveTransportKey(
  tokenBytes: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: string
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', tokenBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8ToBytes(info) },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

// Mirrors pwvault/transport.py's encrypt_for_transport(), unwrapping the two
// nested AES-GCM layers in reverse order (outermost/layer-2 first).
export async function decryptVaultEnvelope(envelope: VaultEnvelope, accessToken: string): Promise<string> {
  const tokenBytes = utf8ToBytes(accessToken);

  const key2 = await deriveTransportKey(tokenBytes, b64ToBytes(envelope.salt2), 'pwvault-transport-2');
  const ct1 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce2) },
    key2,
    b64ToBytes(envelope.ciphertext)
  );

  const key1 = await deriveTransportKey(tokenBytes, b64ToBytes(envelope.salt1), 'pwvault-transport-1');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.nonce1) },
    key1,
    ct1
  );

  return new TextDecoder().decode(plain);
}
