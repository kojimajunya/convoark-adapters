// Tests for scripts/generate-keypair.mjs and scripts/sign-bundle.mjs, run
// as real child processes so the produced output is verified end to end.

import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { verifySignedBundle } from "./signature";

const execFileAsync = promisify(execFile);

const GENERATE_KEYPAIR_SCRIPT = new URL(
  "../scripts/generate-keypair.mjs",
  import.meta.url,
);
const SIGN_BUNDLE_SCRIPT = new URL(
  "../scripts/sign-bundle.mjs",
  import.meta.url,
);

const DEFINITIONS_FIXTURE = {
  schemaVersion: 1,
  definitions: [
    {
      schemaVersion: 1,
      service: "chatgpt",
      definitionVersion: 1,
      origin: "https://chatgpt.com",
      auth: { type: "cookie" },
      endpoints: {
        conversationList: { path: "/backend-api/conversations" },
        conversationDetail: {
          path: "/backend-api/conversation/{conversationId}",
        },
      },
      parser: "chatgpt-mapping",
    },
  ],
};

const PAYLOAD_PATTERN = /^ {2}payload: (".*"),$/m;
const KEY_ID_PATTERN = /^ {4}keyId: (".*"),$/m;
const SIGNATURE_PATTERN = /^ {4}signature: (".*"),$/m;

function extractField(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  const captured = match?.[1];
  if (!captured) {
    throw new Error(`could not find field for pattern: ${pattern}`);
  }
  return JSON.parse(captured);
}

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "scripts-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("generate-keypair.mjs", () => {
  it("prints a keypair JSON for the given key id", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      GENERATE_KEYPAIR_SCRIPT.pathname,
      "test-key-1",
    ]);

    const output = JSON.parse(stdout);

    expect(output.keyId).toBe("test-key-1");
    expect(output.algorithm).toBe("Ed25519");
    expect(typeof output.publicKey).toBe("string");
    expect(output.publicKey.length).toBeGreaterThan(0);
    expect(typeof output.privateKey).toBe("string");
    expect(output.privateKey.length).toBeGreaterThan(0);
    expect(atob(output.publicKey).length).toBe(32);
  });

  it("exits with an error when no key id is given", async () => {
    await expect(
      execFileAsync(process.execPath, [GENERATE_KEYPAIR_SCRIPT.pathname]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Usage:"),
    });
  });
});

describe("sign-bundle.mjs", () => {
  it("writes a signed bundle that verifies against the generated public key", async () => {
    const tempDir = await createTempDir();

    // Isolate the script's relative "../src/local-bundle.ts" output inside
    // the temp directory by copying the script next to a sibling src/ dir.
    const scriptsDir = path.join(tempDir, "scripts");
    const srcDir = path.join(tempDir, "src");
    await mkdir(scriptsDir, { recursive: true });
    await mkdir(srcDir, { recursive: true });
    const copiedScriptPath = path.join(scriptsDir, "sign-bundle.mjs");
    await copyFile(SIGN_BUNDLE_SCRIPT.pathname, copiedScriptPath);

    const { stdout: keyPairStdout } = await execFileAsync(process.execPath, [
      GENERATE_KEYPAIR_SCRIPT.pathname,
      "test-key-1",
    ]);
    const keyPair = JSON.parse(keyPairStdout);

    const signingKeyPath = path.join(tempDir, "signing-key.json");
    await writeFile(signingKeyPath, JSON.stringify(keyPair), "utf8");

    const definitionsPath = path.join(tempDir, "definitions.json");
    await writeFile(
      definitionsPath,
      JSON.stringify(DEFINITIONS_FIXTURE),
      "utf8",
    );

    await execFileAsync(process.execPath, [
      copiedScriptPath,
      definitionsPath,
      signingKeyPath,
    ]);

    const localBundleSource = await readFile(
      path.join(srcDir, "local-bundle.ts"),
      "utf8",
    );

    const payload = extractField(localBundleSource, PAYLOAD_PATTERN);
    const keyId = extractField(localBundleSource, KEY_ID_PATTERN);
    const signature = extractField(localBundleSource, SIGNATURE_PATTERN);

    const bundle = await verifySignedBundle(
      {
        payload,
        signature: { keyId, algorithm: "Ed25519", signature },
      },
      [{ keyId, algorithm: "Ed25519", publicKey: keyPair.publicKey }],
    );

    expect(bundle.definitions).toEqual(DEFINITIONS_FIXTURE.definitions);
    expect(typeof bundle.generatedAt).toBe("string");
    expect(bundle.generatedAt.length).toBeGreaterThan(0);
  });

  it("exits with an error when arguments are missing", async () => {
    await expect(
      execFileAsync(process.execPath, [
        SIGN_BUNDLE_SCRIPT.pathname,
        "only-one-arg.json",
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Usage:"),
    });
  });
});
