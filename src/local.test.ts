import { describe, expect, it } from "vitest";
import { loadAdapterDefinitions } from "./local";
import type {
  BundleSignature,
  SignedAdapterBundle,
  TrustedPublicKey,
} from "./signature";

function encodeBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return (await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  const raw = await globalThis.crypto.subtle.exportKey(
    "raw",
    keyPair.publicKey,
  );
  return encodeBase64(raw);
}

async function signPayload(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const signature = await globalThis.crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(payload),
  );
  return encodeBase64(signature);
}

function samplePayload(): string {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-07-17T00:00:00.000Z",
    definitions: [
      {
        schemaVersion: 1,
        service: "chatgpt",
        definitionVersion: 1,
        origin: "https://chatgpt.com",
        auth: {
          type: "session-bearer",
          sessionPath: "/api/auth/session",
          tokenField: "accessToken",
        },
        endpoints: {
          conversationList: { path: "/backend-api/conversations" },
          conversationDetail: {
            path: "/backend-api/conversation/{conversationId}",
          },
        },
        parser: "chatgpt-mapping",
      },
    ],
  });
}

describe("loadAdapterDefinitions", () => {
  it("loads the bundled definitions with the default trusted keys", async () => {
    const definitions = await loadAdapterDefinitions();
    const services = definitions.map((definition) => definition.service).sort();
    expect(services).toEqual(["chatgpt", "claude"]);
  });

  it("uses an injected source and trusted keys", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = samplePayload();
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    const definitions = await loadAdapterDefinitions({
      source: async () => signed,
      trustedKeys,
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.service).toBe("chatgpt");
  });

  it("propagates verification failures from the injected source", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = samplePayload();
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const tamperedPayload = `${payload.slice(0, -2)}X"`;
    const signed: SignedAdapterBundle = {
      payload: tamperedPayload,
      signature,
    };

    await expect(
      loadAdapterDefinitions({ source: async () => signed, trustedKeys }),
    ).rejects.toThrow("signature verification failed");
  });
});
