import type { TrustedPublicKey } from "./signature";

// Development signing key. Never use for production distribution.
// Production keys must be generated and managed by the repository owner
// and must never be committed to the repository.
export const DEV_KEY_ID = "dev-2026-07";

export const TRUSTED_KEYS: TrustedPublicKey[] = [
  {
    keyId: DEV_KEY_ID,
    algorithm: "Ed25519",
    publicKey: "hBHUHGfd8WffrF/4YMQPd2BR5Ixb2fURBYQr/mM1H8E=",
  },
];
