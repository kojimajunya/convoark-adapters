import type { TrustedPublicKey } from "./signature";

// Production signing key. The private key is held by the repository owner
// outside the repository and must never be committed.
export const PROD_KEY_ID = "prod-2026-07";

export const TRUSTED_KEYS: TrustedPublicKey[] = [
  {
    keyId: PROD_KEY_ID,
    algorithm: "Ed25519",
    publicKey: "MieLdV5BK7/Z1fwN6NxDnb7RNP2lpY13W5eMkBgXf60=",
  },
];
