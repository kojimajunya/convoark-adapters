// Schema for adapter definitions and their runtime validation.
//
// The schema is intentionally restricted to declare "where to read" only:
// it can express endpoint paths and known parser identifiers, but it
// cannot express code execution or an arbitrary destination. Every path
// is validated to be a same-origin relative path, and the origin itself
// must be a bare https origin with no path/port/query.

export const ADAPTER_SCHEMA_VERSION = 1;

export const ALLOWED_PATH_PLACEHOLDERS = [
  "organizationId",
  "conversationId",
] as const;

export const KNOWN_PARSERS = [
  "chatgpt-mapping",
  "claude-chat-messages",
] as const;

export type ParserId = (typeof KNOWN_PARSERS)[number];

export type AdapterAuth =
  | { type: "cookie" }
  | { type: "session-bearer"; sessionPath: string; tokenField: string };

export interface AdapterEndpoint {
  path: string;
}

export interface AdapterDefinition {
  schemaVersion: typeof ADAPTER_SCHEMA_VERSION;
  service: string;
  definitionVersion: number;
  origin: string;
  auth: AdapterAuth;
  endpoints: {
    organizations?: AdapterEndpoint;
    conversationList: AdapterEndpoint;
    conversationDetail: AdapterEndpoint;
  };
  parser: ParserId;
}

export interface AdapterBundle {
  schemaVersion: typeof ADAPTER_SCHEMA_VERSION;
  generatedAt: string;
  definitions: AdapterDefinition[];
}

const SERVICE_PATTERN = /^[a-z][a-z0-9-]*$/;
const ORIGIN_PATTERN = /^https:\/\/[a-z0-9.-]+$/;
const TOKEN_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const PLACEHOLDER_PATTERN = /\{([^}]*)\}/g;

function fail(detail: string): never {
  throw new Error(`invalid adapter bundle: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePath(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    fail(`${fieldName} must be a string`);
  }
  const path = value as string;
  if (!path.startsWith("/")) {
    fail(`${fieldName} must start with a slash`);
  }
  if (path.includes("://")) {
    fail(`${fieldName} must not contain an absolute URL`);
  }
  if (path.includes("..")) {
    fail(`${fieldName} must not contain a parent directory segment`);
  }
  for (const match of path.matchAll(PLACEHOLDER_PATTERN)) {
    const placeholder = match[1] ?? "";
    if (
      !(ALLOWED_PATH_PLACEHOLDERS as readonly string[]).includes(placeholder)
    ) {
      fail(`unknown path placeholder: ${placeholder}`);
    }
  }
  return path;
}

function validateEndpoint(value: unknown, fieldName: string): AdapterEndpoint {
  if (!isRecord(value)) {
    fail(`${fieldName} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const path = validatePath(record.path, `${fieldName}.path`);
  return { path };
}

function validateAuth(value: unknown): AdapterAuth {
  if (!isRecord(value)) {
    fail("auth must be an object");
  }
  const record = value as Record<string, unknown>;
  if (record.type === "cookie") {
    return { type: "cookie" };
  }
  if (record.type === "session-bearer") {
    const sessionPath = validatePath(record.sessionPath, "auth.sessionPath");
    if (
      typeof record.tokenField !== "string" ||
      !TOKEN_FIELD_PATTERN.test(record.tokenField)
    ) {
      fail("auth.tokenField must be a valid field name");
    }
    return {
      type: "session-bearer",
      sessionPath,
      tokenField: record.tokenField,
    };
  }
  fail(`unknown auth type: ${String(record.type)}`);
}

function validateDefinition(value: unknown): AdapterDefinition {
  if (!isRecord(value)) {
    fail("definition must be an object");
  }
  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== ADAPTER_SCHEMA_VERSION) {
    fail(`unsupported schema version: ${String(record.schemaVersion)}`);
  }

  if (
    typeof record.service !== "string" ||
    !SERVICE_PATTERN.test(record.service)
  ) {
    fail(`invalid service name: ${String(record.service)}`);
  }

  if (
    typeof record.definitionVersion !== "number" ||
    !Number.isInteger(record.definitionVersion) ||
    record.definitionVersion < 1
  ) {
    fail(`invalid definition version: ${String(record.definitionVersion)}`);
  }

  if (
    typeof record.origin !== "string" ||
    !ORIGIN_PATTERN.test(record.origin)
  ) {
    fail(`invalid origin: ${String(record.origin)}`);
  }

  const auth = validateAuth(record.auth);

  if (!isRecord(record.endpoints)) {
    fail("endpoints must be an object");
  }
  const endpointsRecord = record.endpoints as Record<string, unknown>;
  const conversationList = validateEndpoint(
    endpointsRecord.conversationList,
    "endpoints.conversationList",
  );
  const conversationDetail = validateEndpoint(
    endpointsRecord.conversationDetail,
    "endpoints.conversationDetail",
  );
  const organizations =
    endpointsRecord.organizations === undefined
      ? undefined
      : validateEndpoint(
          endpointsRecord.organizations,
          "endpoints.organizations",
        );

  if (
    typeof record.parser !== "string" ||
    !(KNOWN_PARSERS as readonly string[]).includes(record.parser)
  ) {
    fail(`unknown parser id: ${String(record.parser)}`);
  }

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    service: record.service,
    definitionVersion: record.definitionVersion,
    origin: record.origin,
    auth,
    endpoints: {
      ...(organizations !== undefined ? { organizations } : {}),
      conversationList,
      conversationDetail,
    },
    parser: record.parser as ParserId,
  };
}

export function parseAdapterBundle(value: unknown): AdapterBundle {
  if (!isRecord(value)) {
    fail("bundle must be an object");
  }
  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== ADAPTER_SCHEMA_VERSION) {
    fail(`unsupported schema version: ${String(record.schemaVersion)}`);
  }

  if (typeof record.generatedAt !== "string") {
    fail("generatedAt must be a string");
  }

  if (!Array.isArray(record.definitions) || record.definitions.length === 0) {
    fail("definitions must be a non-empty array");
  }

  const definitions = record.definitions.map((item) =>
    validateDefinition(item),
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    generatedAt: record.generatedAt,
    definitions,
  };
}
