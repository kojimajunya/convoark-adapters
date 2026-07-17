# @convoark/adapters

Adapter definition schema, Ed25519 signature verification, and a local mode for driving capture without remote definitions.

## Definition schema safety

Adapter definitions can only declare "where to read": same-origin relative paths, a placeholder allowlist, and `https` origins only. Arbitrary code execution or sending data to an arbitrary destination is structurally inexpressible in the schema.

## Signature verification and local mode

Signatures are Ed25519 signatures over the payload string, verified using WebCrypto only. The public key is bundled with the package. `loadAdapterDefinitions()` defaults to the bundled, pre-signed definition bundle and performs no remote fetch.

## Scripts

Generate a signing keypair:

```
node scripts/generate-keypair.mjs <keyId>
```

Sign a definitions bundle:

```
node scripts/sign-bundle.mjs definitions/adapters.json keys/dev-signing-key.json
```

## Keys

`keys/dev-signing-key.json` is for development only. Production signing keys must never be committed to the repository.
