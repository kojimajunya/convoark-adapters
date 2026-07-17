// Ed25519 signature verification for adapter bundles, implemented with
// WebCrypto only (no external dependency).

import type { AdapterBundle } from "./definition";
import { parseAdapterBundle } from "./definition";

export interface TrustedPublicKey {
  keyId: string;
  algorithm: "Ed25519";
  publicKey: string; // base64-encoded raw 32-byte Ed25519 public key
}

export interface BundleSignature {
  keyId: string;
  algorithm: "Ed25519";
  signature: string; // base64
}

export interface SignedAdapterBundle {
  payload: string; // exact JSON string of AdapterBundle; the signature covers the UTF-8 bytes of this string
  signature: BundleSignature;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifySignedBundle(
  signed: SignedAdapterBundle,
  trustedKeys: TrustedPublicKey[],
  cryptoApi: Crypto = globalThis.crypto,
): Promise<AdapterBundle> {
  const { algorithm, keyId, signature } = signed.signature;

  if (algorithm !== "Ed25519") {
    throw new Error(`unsupported signature algorithm: ${algorithm}`);
  }

  const trustedKey = trustedKeys.find((key) => key.keyId === keyId);
  if (!trustedKey) {
    throw new Error(`unknown key id: ${keyId}`);
  }

  const publicKey = await cryptoApi.subtle.importKey(
    "raw",
    decodeBase64(trustedKey.publicKey) as BufferSource,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  const isValid = await cryptoApi.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    decodeBase64(signature) as BufferSource,
    new TextEncoder().encode(signed.payload),
  );

  if (!isValid) {
    throw new Error("signature verification failed");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(signed.payload);
  } catch {
    throw new Error("payload is not valid JSON");
  }

  return parseAdapterBundle(parsed);
}
