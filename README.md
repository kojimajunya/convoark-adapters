# @convoark/adapters

Adapter definition schema, Ed25519 signature verification, and a local mode for driving capture without remote definitions.

## Definition schema safety

Adapter definitions can only declare "where to read": same-origin relative paths, a placeholder allowlist, and `https` origins only. Arbitrary code execution or sending data to an arbitrary destination is structurally inexpressible in the schema.

## Signature verification and local mode

Signatures are Ed25519 signatures over the payload string, verified using WebCrypto only. The public key is bundled with the package. `loadAdapterDefinitions()` defaults to the bundled, pre-signed definition bundle and performs no remote fetch.

## Distributable bundle

`definitions/adapters.signed.json` is the distributable, signed `SignedAdapterBundle` (`{ payload, signature }`). It is what a remote fetch is expected to retrieve, as opposed to `src/local-bundle.ts`, which bundles the same signed content as a TypeScript constant (`LOCAL_SIGNED_BUNDLE`) for the package's local mode. Both files are generated from the same signing operation and always carry identical `payload`/`signature` content.

## Scripts

Generate a signing keypair:

```
node scripts/generate-keypair.mjs <keyId>
```

Sign a definitions bundle. This writes both `src/local-bundle.ts` and `definitions/adapters.signed.json` from the same signature:

```
node scripts/sign-bundle.mjs definitions/adapters.json <path-to-signing-key.json>
```

Re-export `definitions/adapters.signed.json` from the `LOCAL_SIGNED_BUNDLE` already embedded in `src/local-bundle.ts`, without needing the private signing key. Use this only when `definitions/adapters.signed.json` is missing or out of sync with `src/local-bundle.ts`; it refuses to run if `LOCAL_SIGNED_BUNDLE` is not signed with the production key:

```
node scripts/export-signed-bundle.mjs
```

## Keys

Trusted keys are managed in `src/keys.ts` (`TRUSTED_KEYS`). Only the production key (`prod-2026-07`) is currently trusted. Private keys are managed outside this repository and must never be committed.

### Signing definitions

When updating `definitions/adapters.json`, sign it locally with the production private key:

```
node scripts/sign-bundle.mjs definitions/adapters.json <path-to-signing-key.json>
```

CI never signs definitions; signing is a manual, local step performed by whoever holds the production private key.

### Local development verification

To verify signature checking during local development without touching the production key, generate a disposable keypair and temporarily add its public key to `TRUSTED_KEYS`:

```
node scripts/generate-keypair.mjs <keyId>
```

Never commit the temporary key or the modified `TRUSTED_KEYS` entry.

### Key rotation

1. Generate a new keypair and ship a release that adds the new key's public key to `TRUSTED_KEYS` under a new `keyId`, alongside the existing key.
2. Start signing definitions with the new key.
3. Ship a follow-up release that removes the old key from `TRUSTED_KEYS`.
