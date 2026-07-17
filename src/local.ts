// Local mode loader: loads adapter definitions from a bundled, signed
// source with no remote fetch involved. The load source is injectable so
// a remote-fetching implementation can be added later without changing
// this module's contract.

import type { AdapterDefinition } from "./definition";
import { TRUSTED_KEYS } from "./keys";
import { LOCAL_SIGNED_BUNDLE } from "./local-bundle";
import type { SignedAdapterBundle, TrustedPublicKey } from "./signature";
import { verifySignedBundle } from "./signature";

export type SignedBundleSource = () => Promise<SignedAdapterBundle>;

export interface LoadAdapterDefinitionsOptions {
  source?: SignedBundleSource;
  trustedKeys?: TrustedPublicKey[];
  cryptoApi?: Crypto;
}

async function defaultSource(): Promise<SignedAdapterBundle> {
  return LOCAL_SIGNED_BUNDLE;
}

export async function loadAdapterDefinitions(
  options?: LoadAdapterDefinitionsOptions,
): Promise<AdapterDefinition[]> {
  const source = options?.source ?? defaultSource;
  const trustedKeys = options?.trustedKeys ?? TRUSTED_KEYS;
  const cryptoApi = options?.cryptoApi ?? globalThis.crypto;

  const signed = await source();
  const bundle = await verifySignedBundle(signed, trustedKeys, cryptoApi);
  return bundle.definitions;
}
