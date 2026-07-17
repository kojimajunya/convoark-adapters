import { describe, expect, it } from "vitest";
import type {
  BundleSignature,
  SignedAdapterBundle,
  TrustedPublicKey,
} from "./signature";
import { verifySignedBundle } from "./signature";

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

function validBundlePayload(): string {
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

describe("verifySignedBundle", () => {
  it("accepts a bundle signed with a trusted key", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = validBundlePayload();
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    const bundle = await verifySignedBundle(signed, trustedKeys);
    expect(bundle.definitions).toHaveLength(1);
  });

  it("rejects a tampered payload", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = validBundlePayload();
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

    await expect(verifySignedBundle(signed, trustedKeys)).rejects.toThrow(
      "signature verification failed",
    );
  });

  it("rejects a signature made with a different key", async () => {
    const keyPair = await generateKeyPair();
    const otherKeyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = validBundlePayload();
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(otherKeyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    await expect(verifySignedBundle(signed, trustedKeys)).rejects.toThrow(
      "signature verification failed",
    );
  });

  it("rejects an unknown key id", async () => {
    const keyPair = await generateKeyPair();
    const payload = validBundlePayload();
    const signature: BundleSignature = {
      keyId: "unknown-key",
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    await expect(verifySignedBundle(signed, [])).rejects.toThrow(
      "unknown key id",
    );
  });

  it("rejects an unsupported signature algorithm", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = validBundlePayload();
    const signed: SignedAdapterBundle = {
      payload,
      signature: {
        keyId,
        // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid value for the test
        algorithm: "RSA-PSS" as any,
        signature: await signPayload(keyPair.privateKey, payload),
      },
    };

    await expect(verifySignedBundle(signed, trustedKeys)).rejects.toThrow(
      "unsupported signature algorithm",
    );
  });

  it("rejects a payload that is not valid JSON", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = "not valid json";
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    await expect(verifySignedBundle(signed, trustedKeys)).rejects.toThrow(
      "payload is not valid JSON",
    );
  });

  it("rejects a payload that fails bundle validation", async () => {
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair);
    const keyId = "test-key";
    const trustedKeys: TrustedPublicKey[] = [
      { keyId, algorithm: "Ed25519", publicKey },
    ];

    const payload = JSON.stringify({
      schemaVersion: 99,
      generatedAt: "2026-07-17T00:00:00.000Z",
      definitions: [],
    });
    const signature: BundleSignature = {
      keyId,
      algorithm: "Ed25519",
      signature: await signPayload(keyPair.privateKey, payload),
    };
    const signed: SignedAdapterBundle = { payload, signature };

    await expect(verifySignedBundle(signed, trustedKeys)).rejects.toThrow(
      "unsupported schema version",
    );
  });
});
