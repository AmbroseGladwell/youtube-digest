import type { FastifyInstance } from "fastify";
import {
  LinkCodeRequest,
  MagicLinkRequest,
  SignInRequest,
  signInLink,
  type LinkedSession,
  type SignedIn,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { Mailer } from "../mail/Mailer.js";
import { consumeLinkCode } from "./consumeLinkCode.js";
import { consumeMagicLink } from "./consumeMagicLink.js";
import { createSessionForAccount } from "./createSession.js";
import { findOrCreateAccount } from "./findOrCreateAccount.js";
import { issueLinkCode } from "./issueLinkCode.js";
import { issueMagicLink } from "./issueMagicLink.js";
import { sessionCookie } from "./sessionCookie.js";

export interface AuthRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  mailer: Mailer;
  appUrl: string;
  sessionTtlDays: number;
  sessionCookieSecure: boolean;
}

const PUBLIC = { config: { public: true } };

// Every answer here is the same whether or not the address has an account, and an account
// is only ever made by a consumed link, never by asking for one (docs/features/sign-in.md).
export function authRoutes(
  app: FastifyInstance,
  { sql, clock, mailer, appUrl, sessionTtlDays, sessionCookieSecure }: AuthRoutesOptions,
): void {
  app.post("/auth/magic-link", PUBLIC, async (request, reply) => {
    const { email, surface } = parseOrThrow(MagicLinkRequest, request.body, "The sign-in request");
    const issued = await issueMagicLink(sql, { email, surface, now: clock() });
    if (issued !== null) {
      await mailer.sendMagicLink({
        to: issued.email,
        link: signInLink(appUrl, issued.token),
        surface,
        expiresAt: issued.expiresAt,
      });
    }
    return reply.status(202).send({ accepted: true });
  });

  app.post("/auth/sign-in", PUBLIC, async (request, reply) => {
    const { token } = parseOrThrow(SignInRequest, request.body, "The sign-in");
    const now = clock();
    const link = await consumeMagicLink(sql, token, now);
    if (link === null) {
      throw new ApiError("link_invalid", "This link has expired or was already used");
    }
    const accountId = await findOrCreateAccount(sql, link.email);
    if (link.surface === "extension") {
      const code = await issueLinkCode(sql, accountId, now);
      const signedIn: SignedIn = {
        surface: "extension",
        email: link.email,
        linkCode: code.code,
        linkCodeExpiresAt: code.expiresAt,
      };
      return signedIn;
    }
    const session = await createSessionForAccount(sql, accountId, { now, sessionTtlDays });
    reply.header(
      "set-cookie",
      sessionCookie(session.token, { expiresAt: session.expiresAt, now, secure: sessionCookieSecure }),
    );
    const signedIn: SignedIn = { surface: "web", email: link.email, expiresAt: session.expiresAt };
    return signedIn;
  });

  app.post("/auth/link-code", PUBLIC, async (request) => {
    const { code } = parseOrThrow(LinkCodeRequest, request.body, "The link code");
    const now = clock();
    const accountId = await consumeLinkCode(sql, code, now);
    if (accountId === null) {
      throw new ApiError("link_invalid", "That code is wrong, has expired, or was already used");
    }
    const session = await createSessionForAccount(sql, accountId, { now, sessionTtlDays });
    const [account] = await sql.query<{ email: string }>("select email from accounts where id = $1", [accountId]);
    const linked: LinkedSession = { token: session.token, email: account!.email, expiresAt: session.expiresAt };
    return linked;
  });
}
