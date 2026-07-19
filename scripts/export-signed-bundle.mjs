#!/usr/bin/env node
// Exports the SignedAdapterBundle already embedded in src/local-bundle.ts as
// definitions/adapters.signed.json, without requiring the private signing
// key. Intended for the initial export of the distributable bundle; when
// definitions change, re-run scripts/sign-bundle.mjs instead, which writes
// both files from the same signing operation.
// Usage: node scripts/export-signed-bundle.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localBundlePath = path.join(__dirname, "..", "src", "local-bundle.ts");
const keysPath = path.join(__dirname, "..", "src", "keys.ts");

// local-bundle.ts and keys.ts are TypeScript sources, and no TypeScript
// execution environment (e.g. tsx) is available in devDependencies, so the
// values are extracted from the generated source text with the same
// regex-based approach already used by src/scripts.test.ts, rather than
// adding a new external dependency just for this script.
const PAYLOAD_PATTERN = /^ {2}payload: (".*"),$/m;
const KEY_ID_PATTERN = /^ {4}keyId: (".*"),$/m;
const SIGNATURE_PATTERN = /^ {4}signature: (".*"),$/m;
const PROD_KEY_ID_PATTERN = /^export const PROD_KEY_ID = (".*");$/m;

function extractField(source, pattern, sourceLabel) {
  const match = source.match(pattern);
  const captured = match?.[1];
  if (!captured) {
    throw new Error(
      `could not find field for pattern in ${sourceLabel}: ${pattern}`,
    );
  }
  return JSON.parse(captured);
}

const localBundleSource = await readFile(localBundlePath, "utf8");
const keysSource = await readFile(keysPath, "utf8");

const payload = extractField(
  localBundleSource,
  PAYLOAD_PATTERN,
  localBundlePath,
);
const keyId = extractField(localBundleSource, KEY_ID_PATTERN, localBundlePath);
const signature = extractField(
  localBundleSource,
  SIGNATURE_PATTERN,
  localBundlePath,
);
const prodKeyId = extractField(keysSource, PROD_KEY_ID_PATTERN, keysPath);

if (keyId !== prodKeyId) {
  console.error(
    `refusing to export: LOCAL_SIGNED_BUNDLE is signed with keyId "${keyId}", expected the production key "${prodKeyId}"`,
  );
  process.exit(1);
}

const signedBundleJson = {
  payload,
  signature: {
    keyId,
    algorithm: "Ed25519",
    signature,
  },
};

const outputPath = path.join(
  __dirname,
  "..",
  "definitions",
  "adapters.signed.json",
);

await writeFile(
  outputPath,
  `${JSON.stringify(signedBundleJson, null, 2)}\n`,
  "utf8",
);

console.error(`Signed bundle exported to ${outputPath}`);
