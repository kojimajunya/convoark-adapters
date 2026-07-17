#!/usr/bin/env node
// Generates an Ed25519 key pair for development/test signing use.
// Usage: node scripts/generate-keypair.mjs <keyId>
//
// No external dependency: uses only Node's WebCrypto (globalThis.crypto).

const keyId = process.argv[2];

if (!keyId) {
  console.error("Usage: node scripts/generate-keypair.mjs <keyId>");
  process.exit(1);
}

function encodeBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

const keyPair = await globalThis.crypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
);

const publicKeyRaw = await globalThis.crypto.subtle.exportKey(
  "raw",
  keyPair.publicKey,
);
const privateKeyPkcs8 = await globalThis.crypto.subtle.exportKey(
  "pkcs8",
  keyPair.privateKey,
);

const output = {
  keyId,
  algorithm: "Ed25519",
  publicKey: encodeBase64(publicKeyRaw),
  privateKey: encodeBase64(privateKeyPkcs8),
};

console.log(JSON.stringify(output, null, 2));
