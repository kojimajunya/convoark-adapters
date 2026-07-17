import { describe, expect, it } from "vitest";
import { parseAdapterBundle } from "./definition";

// biome-ignore lint/suspicious/noExplicitAny: raw JSON-like fixtures are intentionally loosely typed for validation tests
type RawDefinition = Record<string, any>;

function validBundle() {
  const chatgpt: RawDefinition = {
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
  };

  const claude: RawDefinition = {
    schemaVersion: 1,
    service: "claude",
    definitionVersion: 1,
    origin: "https://claude.ai",
    auth: { type: "cookie" },
    endpoints: {
      organizations: { path: "/api/organizations" },
      conversationList: {
        path: "/api/organizations/{organizationId}/chat_conversations",
      },
      conversationDetail: {
        path: "/api/organizations/{organizationId}/chat_conversations/{conversationId}",
      },
    },
    parser: "claude-chat-messages",
  };

  return {
    schemaVersion: 1,
    generatedAt: "2026-07-17T00:00:00.000Z",
    definitions: [chatgpt, claude] as [RawDefinition, RawDefinition],
  };
}

describe("parseAdapterBundle", () => {
  it("accepts a valid bundle with chatgpt and claude definitions", () => {
    const bundle = parseAdapterBundle(validBundle());
    expect(bundle.definitions).toHaveLength(2);
    expect(bundle.definitions[0]?.service).toBe("chatgpt");
    expect(bundle.definitions[1]?.service).toBe("claude");
  });

  it("rejects an unsupported schema version", () => {
    const bundle = validBundle();
    bundle.schemaVersion = 2;
    expect(() => parseAdapterBundle(bundle)).toThrow(
      "unsupported schema version",
    );
  });

  it("rejects a path that does not start with a slash", () => {
    const bundle = validBundle();
    bundle.definitions[0].endpoints.conversationList.path = "backend-api/x";
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });

  it("rejects a path containing an absolute URL", () => {
    const bundle = validBundle();
    bundle.definitions[0].endpoints.conversationList.path =
      "/x?u=https://evil.example";
    expect(() => parseAdapterBundle(bundle)).toThrow();

    const tampered = validBundle();
    tampered.definitions[0].endpoints.conversationList.path =
      "https://evil.example/x";
    expect(() => parseAdapterBundle(tampered)).toThrow();

    const tampered2 = validBundle();
    tampered2.definitions[0].endpoints.conversationList.path = "/x/https://e";
    expect(() => parseAdapterBundle(tampered2)).toThrow();
  });

  it("rejects a path containing a parent directory segment", () => {
    const bundle = validBundle();
    bundle.definitions[0].endpoints.conversationList.path = "/a/../b";
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });

  it("rejects an unknown path placeholder", () => {
    const bundle = validBundle();
    bundle.definitions[0].endpoints.conversationList.path = "/api/{userId}";
    expect(() => parseAdapterBundle(bundle)).toThrow(
      "unknown path placeholder",
    );
  });

  it("rejects a non-https origin", () => {
    const bundle = validBundle();
    bundle.definitions[0].origin = "http://chatgpt.com";
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });

  it("rejects an origin containing a path", () => {
    const bundle = validBundle();
    bundle.definitions[0].origin = "https://chatgpt.com/api";
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });

  it("rejects an unknown parser id", () => {
    const bundle = validBundle();
    bundle.definitions[0].parser = "gemini-parser";
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });

  it("rejects invalid auth shapes", () => {
    const bundle = validBundle();
    bundle.definitions[0].auth = { type: "oauth" };
    expect(() => parseAdapterBundle(bundle)).toThrow();

    const bundle2 = validBundle();
    bundle2.definitions[0].auth = {
      type: "session-bearer",
      sessionPath: "/s",
    };
    expect(() => parseAdapterBundle(bundle2)).toThrow();
  });

  it("rejects a non-positive or non-integer definition version", () => {
    const bundle = validBundle();
    bundle.definitions[0].definitionVersion = 0;
    expect(() => parseAdapterBundle(bundle)).toThrow();

    const bundle2 = validBundle();
    bundle2.definitions[0].definitionVersion = 1.5;
    expect(() => parseAdapterBundle(bundle2)).toThrow();
  });

  it("rejects an empty definitions array", () => {
    const bundle = validBundle();
    // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid value for the test
    (bundle as any).definitions = [];
    expect(() => parseAdapterBundle(bundle)).toThrow();
  });
});
