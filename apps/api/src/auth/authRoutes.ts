import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  EmailCodeRequest,
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
import type { RateLimit } from "../rateLimit/RateLimit.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { accountExists } from "./accountExists.js";
import { consumeLinkCode } from "./consumeLinkCode.js";
import { consumeMagicLink, consumeMagicLinkCode, type ConsumedMagicLink } from "./consumeMagicLink.js";
import { createSessionForAccount } from "./createSession.js";
import { findOrCreateAccount } from "./findOrCreateAccount.js";
import { issueLinkCode } from "./issueLinkCode.js";
import { issueMagicLink } from "./issueMagicLink.js";
import { normaliseEmail } from "./normaliseEmail.js";
import type { EventSink } from "../events/EventSink.js";
import { sessionCookie } from "./sessionCookie.js";

export interface AuthRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  mailer: Mailer;
  appUrl: string;
  sessionTtlDays: number;
  sessionCookieSecure: boolean;
  eventSink: EventSink | null;
}

const PUBLIC = { config: { public: true } };

const emailOf = (request: FastifyRequest): string | null => {
  const parsed = MagicLinkRequest.safeParse(request.body);
  return parsed.success ? normaliseEmail(parsed.data.email) : null;
};

const codeEmailOf = (request: FastifyRequest): string | null => {
  const parsed = EmailCodeRequest.safeParse(request.body);
  return parsed.success ? normaliseEmail(parsed.data.email) : null;
};

// Every answer here is the same whether or not the address has an account, and an account
// is only ever made by a consumed link, never by asking for one. Only the mail differs: an
// address that asks to create an account it already has is sent a sign-in link
// (docs/features/sign-in.md).
export function authRoutes(
  app: FastifyInstance,
  { sql, clock, mailer, appUrl, sessionTtlDays, sessionCookieSecure, eventSink }: AuthRoutesOptions,
): void {
  const perAddress = (rateLimit: RateLimit) => rateLimitHook(rateLimit, (request) => request.clientAddress, clock);
  const magicLinkLimits = [perAddress(rateLimits.magicLinkPerAddress), rateLimitHook(rateLimits.magicLinkPerEmail, emailOf, clock)];

  app.post("/auth/magic-link", { ...PUBLIC, preHandler: magicLinkLimits }, async (request, reply) => {
    const { email, surface, intent, firstName = null, returnTo = null, anonymousId } = parseOrThrow(
      MagicLinkRequest,
      request.body,
      "The sign-in request",
    );
    const issued = await issueMagicLink(sql, {
      email,
      surface,
      intent,
      firstName,
      anonymousId: intent === "createAccount" ? (anonymousId ?? null) : null,
      now: clock(),
    });
    if (issued === null) {
      request.log.warn({ surface, intent, reason: "cooldown" }, "magic link held back");
    } else {
      const creating = intent === "createAccount" && !(await accountExists(sql, issued.email));
      const purpose = creating ? "createAccount" : "signIn";
      await mailer.sendMagicLink({
        to: issued.email,
        link: signInLink(appUrl, issued.token, surface === "web" ? returnTo : null),
        code: issued.code,
        surface,
        purpose,
        firstName: creating ? firstName : null,
        expiresAt: issued.expiresAt,
      });
      request.log.info({ surface, purpose }, "magic link sent");
    }
    return reply.status(202).send({ accepted: true });
  });

  const signInWith = async (
    link: ConsumedMagicLink,
    now: Date,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SignedIn> => {
    const account = await findOrCreateAccount(sql, link.email, link.firstName);
    request.log.info(
      { accountId: account.id, created: account.created, intent: link.intent, surface: link.surface },
      account.created ? "account created" : "signed in",
    );
    if (account.created && link.anonymousId !== null && eventSink !== null) {
      void eventSink.link(account.id, link.anonymousId, now).then(
        () => request.log.info({ accountId: account.id }, "anonymous id linked"),
        (error: unknown) => request.log.warn({ accountId: account.id, error: String(error) }, "anonymous id not linked"),
      );
    }
    if (link.surface === "extension") {
      const code = await issueLinkCode(sql, account.id, now);
      const signedIn: SignedIn = {
        surface: "extension",
        email: link.email,
        firstName: account.firstName,
        linkCode: code.code,
        linkCodeExpiresAt: code.expiresAt,
      };
      return signedIn;
    }
    const session = await createSessionForAccount(sql, account.id, { now, sessionTtlDays });
    request.log.info({ accountId: account.id, sessionId: session.id, surface: "web" }, "session created");
    reply.header(
      "set-cookie",
      sessionCookie(session.token, { expiresAt: session.expiresAt, now, secure: sessionCookieSecure }),
    );
    const signedIn: SignedIn = {
      surface: "web",
      accountId: account.id,
      email: link.email,
      firstName: account.firstName,
      expiresAt: session.expiresAt,
    };
    return signedIn;
  };

  app.post("/auth/sign-in", { ...PUBLIC, preHandler: perAddress(rateLimits.signInPerAddress) }, async (request, reply) => {
    const { token } = parseOrThrow(SignInRequest, request.body, "The sign-in");
    const now = clock();
    const link = await consumeMagicLink(sql, token, now);
    if (link === null) {
      throw new ApiError("link_invalid", "This link has expired or was already used");
    }
    return signInWith(link, now, request, reply);
  });

  const emailCodeLimits = [perAddress(rateLimits.emailCodePerAddress), rateLimitHook(rateLimits.emailCodePerEmail, codeEmailOf, clock)];

  app.post("/auth/email-code", { ...PUBLIC, preHandler: emailCodeLimits }, async (request, reply) => {
    const { email, code } = parseOrThrow(EmailCodeRequest, request.body, "The email code");
    const now = clock();
    const link = await consumeMagicLinkCode(sql, email, code, now);
    if (link === null) {
      throw new ApiError("link_invalid", "That code is wrong, has expired, or was already used");
    }
    return signInWith(link, now, request, reply);
  });

  app.post("/auth/link-code", { ...PUBLIC, preHandler: perAddress(rateLimits.linkCodePerAddress) }, async (request) => {
    const { code } = parseOrThrow(LinkCodeRequest, request.body, "The link code");
    const now = clock();
    const accountId = await consumeLinkCode(sql, code, now);
    if (accountId === null) {
      throw new ApiError("link_invalid", "That code is wrong, has expired, or was already used");
    }
    const session = await createSessionForAccount(sql, accountId, { now, sessionTtlDays });
    request.log.info({ accountId, sessionId: session.id, surface: "extension" }, "session created");
    const [account] = await sql.query<{ email: string; first_name: string | null }>(
      "select email, first_name from accounts where id = $1",
      [accountId],
    );
    const linked: LinkedSession = {
      token: session.token,
      accountId,
      email: account!.email,
      firstName: account!.first_name,
      expiresAt: session.expiresAt,
    };
    return linked;
  });
}
