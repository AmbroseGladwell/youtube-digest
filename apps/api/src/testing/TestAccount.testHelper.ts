import type { LightMyRequestResponse } from "fastify";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import type { RecordKind } from "../records/RecordKind.js";
import type { TestApp } from "./createTestApp.testHelper.js";

export interface InjectOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  body?: unknown;
  ifMatch?: number;
  clientVersion?: number;
}

export interface Change {
  kind: RecordKind;
  id: string;
  schemaVersion: number;
  rev: number;
  seq: number;
  updatedAt: string | null;
  deleted: boolean;
  body?: Record<string, unknown>;
}

export interface ChangesBody {
  changes: Change[];
  next: number;
  more: boolean;
}

export interface TestAccount {
  accountId: AccountId;
  headers: Record<string, string>;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  changes(since?: number, limit?: number): Promise<ChangesBody>;
  change(kind: RecordKind, id: string): Promise<Change>;
  seedRaw(kind: RecordKind, id: string, schemaVersion: number, body: Record<string, unknown>): Promise<void>;
}

// One account per test: isolation by account rather than by database, which is cheap and
// exercises account scoping on every request (docs/conventions/backend-testing-guide.md).
export async function makeAccount({ app, sql, clock }: TestApp): Promise<TestAccount> {
  const session = await makeSession(sql, { now: clock.now });
  const inject = ({ method, url, body, ifMatch, clientVersion = CLIENT_VERSION }: InjectOptions) =>
    app.inject({
      method,
      url,
      headers: {
        ...session.headers,
        [CLIENT_VERSION_HEADER]: String(clientVersion),
        ...(ifMatch === undefined ? {} : { "if-match": `"${ifMatch}"` }),
      },
      ...(body === undefined ? {} : { payload: body as object }),
    });
  const changes = async (since = 0, limit = 200): Promise<ChangesBody> => {
    const response = await inject({ method: "GET", url: `/api/changes?since=${since}&limit=${limit}` });
    if (response.statusCode !== 200) {
      throw new Error(`changes answered ${response.statusCode}: ${response.body}`);
    }
    return response.json();
  };

  return {
    accountId: session.accountId,
    headers: session.headers,
    inject,
    changes,
    change: async (kind, id) => {
      const found = (await changes()).changes.find((change) => change.kind === kind && change.id === id);
      if (found === undefined) {
        throw new Error(`the feed carries no ${kind} ${id}`);
      }
      return found;
    },
    seedRaw: async (kind, id, schemaVersion, body) => {
      const [row] = await sql.query<{ last_seq: number | string | bigint }>(
        "update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq",
        [session.accountId],
      );
      await sql.query(
        `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, deleted, body)
         values ($1, $2, $3, $4, 1, $5, $6, false, $7::jsonb)`,
        [session.accountId, kind, id, schemaVersion, Number(row!.last_seq), clock.now.toISOString(), JSON.stringify(body)],
      );
    },
  };
}
