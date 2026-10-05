import test from "node:test";
import assert from "node:assert/strict";
import type { LightMyRequestResponse } from "fastify";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createLogger } from "../logs/createLogger.js";
import { createTestApp, TEST_APP_URL, type TestApp } from "../testing/createTestApp.testHelper.js";
import { hashToken } from "./hashToken.js";
import { SESSION_COOKIE } from "./sessionCookie.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const EMAIL = "reader@example.com";

const setCookie = (response: LightMyRequestResponse): string => {
  const header = response.headers["set-cookie"];
  assert.ok(header !== undefined, "a cookie was set");
  return Array.isArray(header) ? header[0]! : header;
};

const cookiePair = (response: LightMyRequestResponse): string => setCookie(response).split(";")[0]!;

const askForLink = (testApp: TestApp, surface: "web" | "extension", email = EMAIL) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", payload: { email, surface } });

const signIn = (testApp: TestApp, token: string) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/sign-in", payload: { token } });

const enterCode = (testApp: TestApp, code: string, email = EMAIL) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/email-code", payload: { email, code } });

const exchange = (testApp: TestApp, code: string) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/link-code", payload: { code } });

const whoAmI = (testApp: TestApp, headers: Record<string, string>) =>
  testApp.app.inject({ method: "GET", url: "/api/session", headers });

const signInOnTheWeb = async (testApp: TestApp): Promise<string> => {
  await askForLink(testApp, "web");
  const response = await signIn(testApp, testApp.mailer.lastToken());
  assert.equal(response.statusCode, 200);
  return cookiePair(response);
};

test("asking for a link mails one that points at the app, and keeps only the token's hash", async () => {
  const testApp = await createTestApp();

  const response = await askForLink(testApp, "web", " Reader@Example.com ");

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { accepted: true });
  assert.equal(testApp.mailer.sent.length, 1);
  const [mail] = testApp.mailer.sent;
  assert.equal(mail!.to, EMAIL);
  assert.equal(mail!.surface, "web");
  assert.ok(mail!.link.startsWith(`${TEST_APP_URL}/sign-in#token=`), mail!.link);
  const rows = await testApp.sql.query<{ token_hash: string; email: string }>("select token_hash, email from magic_links");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.email, EMAIL);
  assert.equal(rows[0]!.token_hash, hashToken(testApp.mailer.lastToken()));
  await testApp.close();
});

const CONSENT = "/connect/0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";

const askForLinkBack = (testApp: TestApp, surface: "web" | "extension", returnTo: string) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", payload: { email: EMAIL, surface, returnTo } });

test("a link asked for from the consent screen returns there once it has signed in", async () => {
  const testApp = await createTestApp();

  const response = await askForLinkBack(testApp, "web", CONSENT);

  assert.equal(response.statusCode, 202);
  const link = new URL(testApp.mailer.sent[0]!.link);
  assert.equal(link.pathname, "/sign-in");
  assert.equal(link.searchParams.get("return"), CONSENT);
  await testApp.close();
});

test("a link can be asked to return only to a consent screen", async () => {
  const testApp = await createTestApp();

  const response = await askForLinkBack(testApp, "web", "https://evil.example/");

  assert.equal(response.statusCode, 400);
  assert.equal(testApp.mailer.sent.length, 0);
  await testApp.close();
});

test("an extension link returns nowhere, since it signs in the panel and not the tab", async () => {
  const testApp = await createTestApp();

  await askForLinkBack(testApp, "extension", CONSENT);

  assert.equal(new URL(testApp.mailer.sent[0]!.link).search, "");
  await testApp.close();
});

test("asking for a link makes no account: only a consumed link does", async () => {
  const testApp = await createTestApp();

  await askForLink(testApp, "web");

  assert.deepEqual(await testApp.sql.query("select id from accounts"), []);
  await testApp.close();
});

test("an address that is not an email is refused before anything is sent", async () => {
  const testApp = await createTestApp();

  const response = await askForLink(testApp, "web", "not an address");

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");
  assert.equal(testApp.mailer.sent.length, 0);
  await testApp.close();
});

test("a second ask within a minute is answered the same and sends nothing", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  testApp.clock.advance(30 * 1000);

  const second = await askForLink(testApp, "web");

  assert.equal(second.statusCode, 202);
  assert.equal(testApp.mailer.sent.length, 1);
  testApp.clock.advance(MINUTE_MS);
  await askForLink(testApp, "web");
  assert.equal(testApp.mailer.sent.length, 2);
  await testApp.close();
});

test("a web link signs the browser in with a cookie the API then accepts", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(response.statusCode, 200);
  assert.match(setCookie(response), new RegExp(`^${SESSION_COOKIE}=.+; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax; Secure$`));
  const session = await whoAmI(testApp, { cookie: cookiePair(response) });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().email, EMAIL);
  assert.deepEqual(response.json(), {
    surface: "web",
    accountId: session.json().accountId,
    email: EMAIL,
    firstName: null,
    expiresAt: "2026-10-26T09:00:00.000Z",
  });
  await testApp.close();
});

test("the cookie is not marked Secure when the app is served over plain http", async () => {
  const testApp = await createTestApp({ appUrl: "http://localhost:5173" });
  await askForLink(testApp, "web");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.doesNotMatch(setCookie(response), /Secure/);
  await testApp.close();
});

test("a link works once: the second use is refused as link_invalid", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  const token = testApp.mailer.lastToken();
  await signIn(testApp, token);

  const again = await signIn(testApp, token);

  assert.equal(again.statusCode, 410);
  assert.equal(again.json().error.code, "link_invalid");
  assert.equal(again.headers["set-cookie"], undefined);
  await testApp.close();
});

test("a link older than fifteen minutes is refused, and so is a token nobody was sent", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  testApp.clock.advance(16 * MINUTE_MS);

  const expired = await signIn(testApp, testApp.mailer.lastToken());
  const unknown = await signIn(testApp, "never-issued");

  assert.equal(expired.json().error.code, "link_invalid");
  assert.equal(unknown.json().error.code, "link_invalid");
  assert.equal(unknown.statusCode, expired.statusCode);
  await testApp.close();
});

test("a web mail carries a code, kept only as its hash", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");

  const code = testApp.mailer.lastCode();

  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const [row] = await testApp.sql.query<{ code_hash: string }>("select code_hash from magic_links");
  assert.equal(row!.code_hash, hashToken(code.replace("-", "")));
  await testApp.close();
});

test("an extension mail carries no code, since its link leads to one", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "extension");

  assert.equal(testApp.mailer.sent[0]!.code, null);
  await testApp.close();
});

test("the code from a web mail signs the browser in with a cookie, however it was typed", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  const typed = ` ${testApp.mailer.lastCode().toLowerCase().replace("-", " ")} `;

  const response = await enterCode(testApp, typed, " Reader@Example.com ");

  assert.equal(response.statusCode, 200);
  const session = await whoAmI(testApp, { cookie: cookiePair(response) });
  assert.equal(session.json().email, EMAIL);
  assert.deepEqual(response.json(), {
    surface: "web",
    accountId: session.json().accountId,
    email: EMAIL,
    firstName: null,
    expiresAt: "2026-10-26T09:00:00.000Z",
  });
  await testApp.close();
});

test("one mail signs in once: the code spends the link, and the link spends the code", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  const token = testApp.mailer.lastToken();
  const code = testApp.mailer.lastCode();

  assert.equal((await enterCode(testApp, code)).statusCode, 200);
  assert.equal((await enterCode(testApp, code)).json().error.code, "link_invalid");
  assert.equal((await signIn(testApp, token)).json().error.code, "link_invalid");

  testApp.clock.advance(MINUTE_MS);
  await askForLink(testApp, "web");
  assert.equal((await signIn(testApp, testApp.mailer.lastToken())).statusCode, 200);
  const spent = await enterCode(testApp, testApp.mailer.lastCode());
  assert.equal(spent.statusCode, 410);
  assert.equal(spent.headers["set-cookie"], undefined);
  await testApp.close();
});

test("a code works only with the address it was sent to, and only for fifteen minutes", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "web");
  const code = testApp.mailer.lastCode();

  assert.equal((await enterCode(testApp, code, "someone-else@example.com")).json().error.code, "link_invalid");
  assert.equal((await enterCode(testApp, "ABCD-EFGH")).json().error.code, "link_invalid");
  testApp.clock.advance(16 * MINUTE_MS);
  const expired = await enterCode(testApp, code);
  assert.equal(expired.statusCode, 410);
  assert.equal(expired.json().error.code, "link_invalid");
  assert.deepEqual(await testApp.sql.query("select id from accounts"), []);
  await testApp.close();
});

test("a create-account mail's code makes the account with the name it was asked with", async () => {
  const testApp = await createTestApp();
  await testApp.app.inject({
    method: "POST",
    url: "/api/auth/magic-link",
    payload: { email: EMAIL, surface: "web", intent: "createAccount", firstName: "Ada" },
  });

  const response = await enterCode(testApp, testApp.mailer.lastCode());

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().firstName, "Ada");
  await testApp.close();
});

test("a link asked for from the extension answers a code and signs no browser in", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "extension");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.surface, "extension");
  assert.equal(body.email, EMAIL);
  assert.match(body.linkCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(body.linkCodeExpiresAt, "2026-09-26T09:10:00.000Z");
  assert.equal(response.headers["set-cookie"], undefined);
  assert.deepEqual(await testApp.sql.query("select id from sessions"), []);
  assert.equal((await testApp.sql.query("select id from accounts")).length, 1);
  await testApp.close();
});

test("the code exchanges once for a bearer the panel can sync with", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "extension");
  const { linkCode } = (await signIn(testApp, testApp.mailer.lastToken())).json();

  const exchanged = await exchange(testApp, linkCode);

  assert.equal(exchanged.statusCode, 200);
  const { token, email, expiresAt } = exchanged.json();
  assert.equal(email, EMAIL);
  assert.equal(expiresAt, "2026-10-26T09:00:00.000Z");
  const headers = { authorization: `Bearer ${token}`, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
  assert.equal((await whoAmI(testApp, headers)).json().email, EMAIL);
  assert.equal((await testApp.app.inject({ method: "GET", url: "/api/changes?since=0", headers })).statusCode, 200);
  const again = await exchange(testApp, linkCode);
  assert.equal(again.statusCode, 410);
  assert.equal(again.json().error.code, "link_invalid");
  await testApp.close();
});

test("a code is read however the reader typed it, and refused once ten minutes have passed", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "extension");
  const { linkCode } = (await signIn(testApp, testApp.mailer.lastToken())).json();
  const typed = ` ${(linkCode as string).toLowerCase().replace("-", " ")} `;
  testApp.clock.advance(11 * MINUTE_MS);
  assert.equal((await exchange(testApp, typed)).json().error.code, "link_invalid");

  const fresh = await createTestApp();
  await askForLink(fresh, "extension");
  const second = (await signIn(fresh, fresh.mailer.lastToken())).json();
  const relaxed = await exchange(fresh, ` ${(second.linkCode as string).toLowerCase().replace("-", " ")} `);

  assert.equal(relaxed.statusCode, 200);
  await testApp.close();
  await fresh.close();
});

const mintCode = (testApp: TestApp, headers: Record<string, string>) =>
  testApp.app.inject({ method: "POST", url: "/api/session/link-code", headers });

test("a web app already signed in hands the extension a code that signs it in with no email", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);
  const mailed = testApp.mailer.sent.length;

  const minted = await mintCode(testApp, { cookie, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) });

  assert.equal(minted.statusCode, 200);
  const { linkCode, linkCodeExpiresAt } = minted.json();
  assert.match(linkCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(linkCodeExpiresAt, "2026-09-26T09:10:00.000Z");
  const exchanged = await exchange(testApp, linkCode);
  assert.equal(exchanged.statusCode, 200);
  assert.equal(exchanged.json().email, EMAIL);
  const bearer = { authorization: `Bearer ${exchanged.json().token}` };
  assert.equal((await whoAmI(testApp, bearer)).json().email, EMAIL);
  const webSession = await whoAmI(testApp, { cookie });
  assert.equal(webSession.statusCode, 200);
  assert.equal(exchanged.json().accountId, webSession.json().accountId);
  assert.equal(testApp.mailer.sent.length, mailed);
  await testApp.close();
});

test("a minted code works once and lapses after ten minutes, like an emailed one", async () => {
  const testApp = await createTestApp();
  const headers = { cookie: await signInOnTheWeb(testApp), [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
  const first = (await mintCode(testApp, headers)).json().linkCode;
  const second = (await mintCode(testApp, headers)).json().linkCode;

  assert.equal((await exchange(testApp, first)).statusCode, 200);
  assert.equal((await exchange(testApp, first)).json().error.code, "link_invalid");
  testApp.clock.advance(11 * MINUTE_MS);
  assert.equal((await exchange(testApp, second)).json().error.code, "link_invalid");
  await testApp.close();
});

test("minting a code needs a session, and the client version a cross-site form cannot send", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);

  assert.equal((await mintCode(testApp, { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) })).statusCode, 401);
  assert.equal((await mintCode(testApp, { cookie })).statusCode, 400);
  assert.deepEqual(await testApp.sql.query("select id from link_codes"), []);
  await testApp.close();
});

test("signing out with the cookie deletes the session and clears the cookie", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);

  const signOut = await testApp.app.inject({
    method: "DELETE",
    url: "/api/session",
    headers: { cookie, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.equal(signOut.statusCode, 204);
  assert.match(setCookie(signOut), new RegExp(`^${SESSION_COOKIE}=; Max-Age=0;`));
  assert.equal((await whoAmI(testApp, { cookie })).statusCode, 401);
  await testApp.close();
});

test("signing in, a session made for the extension and signing out are logged by account id, never by address", async () => {
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger([{ write: (chunk: string) => void lines.push(JSON.parse(chunk)) }]);
  const testApp = await createTestApp({}, { logger });
  const cookie = await signInOnTheWeb(testApp);
  const { accountId } = (await whoAmI(testApp, { cookie })).json();
  const headers = { cookie, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
  const { linkCode } = (await testApp.app.inject({ method: "POST", url: "/api/session/link-code", headers })).json();
  await exchange(testApp, linkCode);

  await testApp.app.inject({ method: "DELETE", url: "/api/session", headers });

  const line = (msg: string) => lines.find((logged) => logged.msg === msg);
  assert.equal(line("account created")?.accountId, accountId);
  assert.equal(lines.find((logged) => logged.msg === "session created" && logged.surface === "extension")?.accountId, accountId);
  assert.deepEqual(
    { accountId: line("signed out")?.accountId, transport: line("signed out")?.transport },
    { accountId, transport: "cookie" },
  );
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(EMAIL));
  await testApp.close();
});

test("a write with the cookie still needs the client version, so a cross-site form cannot make one", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);

  const response = await testApp.app.inject({ method: "DELETE", url: "/api/session", headers: { cookie } });

  assert.equal(response.statusCode, 400);
  assert.equal((await whoAmI(testApp, { cookie })).statusCode, 200);
  await testApp.close();
});

test("a cookie session used more than an hour on is re-issued with its new expiry", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);
  testApp.clock.advance(2 * HOUR_MS);

  const response = await whoAmI(testApp, { cookie });

  assert.equal(response.json().expiresAt, "2026-10-26T11:00:00.000Z");
  assert.match(setCookie(response), /Max-Age=2592000;/);
  const within = await whoAmI(testApp, { cookie });
  assert.equal(within.headers["set-cookie"], undefined);
  await testApp.close();
});

test("a bearer is looked at before the cookie, so the extension's header is never mistaken for the tab's session", async () => {
  const testApp = await createTestApp();
  const cookie = await signInOnTheWeb(testApp);

  const response = await whoAmI(testApp, { cookie, authorization: "Bearer not-a-real-token" });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("the auth routes need no session and no client version", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({ method: "POST", url: "/api/auth/link-code", payload: { code: "nope" } });

  assert.equal(response.statusCode, 410);
  await testApp.close();
});

const askToCreate = (testApp: TestApp, surface: "web" | "extension", firstName: string, email = EMAIL) =>
  testApp.app.inject({
    method: "POST",
    url: "/api/auth/magic-link",
    payload: { email, surface, intent: "createAccount", firstName },
  });

test("asking to create an account mails a link that says so, greets by name, and still makes no account", async () => {
  const testApp = await createTestApp();

  const response = await askToCreate(testApp, "web", "  Ada ");

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { accepted: true });
  assert.equal(testApp.mailer.sent[0]!.purpose, "createAccount");
  assert.equal(testApp.mailer.sent[0]!.firstName, "Ada");
  assert.deepEqual(await testApp.sql.query("select id from accounts"), []);
  await testApp.close();
});

test("opening a create-account link makes the account with the name it was asked with", async () => {
  const testApp = await createTestApp();
  await askToCreate(testApp, "web", "Ada");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(response.json().firstName, "Ada");
  assert.equal((await whoAmI(testApp, { cookie: cookiePair(response) })).json().firstName, "Ada");
  await testApp.close();
});

test("an address that already has an account is sent a sign-in link and keeps its name", async () => {
  const testApp = await createTestApp();
  await askToCreate(testApp, "web", "Ada");
  await signIn(testApp, testApp.mailer.lastToken());
  testApp.clock.advance(2 * MINUTE_MS);

  const asked = await askToCreate(testApp, "web", "Someone Else");
  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(asked.statusCode, 202);
  assert.equal(testApp.mailer.sent[1]!.purpose, "signIn");
  assert.equal(testApp.mailer.sent[1]!.firstName, null);
  assert.equal(response.json().firstName, "Ada");
  await testApp.close();
});

test("an account made by signing in has no name, and says so rather than inventing one", async () => {
  const testApp = await createTestApp();

  const cookie = await signInOnTheWeb(testApp);

  assert.equal((await whoAmI(testApp, { cookie })).json().firstName, null);
  await testApp.close();
});

test("the extension's code hands over the name with the bearer", async () => {
  const testApp = await createTestApp();
  await askToCreate(testApp, "extension", "Ada");
  const signedIn = await signIn(testApp, testApp.mailer.lastToken());

  const response = await exchange(testApp, signedIn.json().linkCode);

  assert.equal(signedIn.json().firstName, "Ada");
  assert.equal(response.json().firstName, "Ada");
  await testApp.close();
});

test("a first name that is blank or too long is refused before anything is sent", async () => {
  const testApp = await createTestApp();

  const blank = await askToCreate(testApp, "web", "   ");
  const long = await askToCreate(testApp, "web", "a".repeat(81));

  assert.equal(blank.json().error.code, "invalid_request");
  assert.equal(long.json().error.code, "invalid_request");
  assert.equal(testApp.mailer.sent.length, 0);
  await testApp.close();
});

const ANONYMOUS_ID = "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const askToCreateSharing = (testApp: TestApp, surface: "web" | "extension", email = EMAIL) =>
  testApp.app.inject({
    method: "POST",
    url: "/api/auth/magic-link",
    payload: { email, surface, intent: "createAccount", firstName: "Ada", anonymousId: ANONYMOUS_ID },
  });

test("a reader who said yes without an account has what they shared linked to the account they make, once", async () => {
  const testApp = await createTestApp();
  await askToCreateSharing(testApp, "web");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.deepEqual(testApp.eventSink.links, [{ accountId: response.json().accountId, anonymousId: ANONYMOUS_ID }]);
  await testApp.close();
});

test("an extension's create-account link links the id when the browser opens it", async () => {
  const testApp = await createTestApp();
  await askToCreateSharing(testApp, "extension");

  await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(testApp.eventSink.links.length, 1);
  await testApp.close();
});

test("an account that already existed is never linked to an anonymous id", async () => {
  const testApp = await createTestApp();
  await signInOnTheWeb(testApp);
  testApp.clock.advance(2 * MINUTE_MS);

  await askToCreateSharing(testApp, "web");
  await signIn(testApp, testApp.mailer.lastToken());

  assert.deepEqual(testApp.eventSink.links, []);
  await testApp.close();
});

test("an anonymous id sent with an ordinary sign-in is not kept", async () => {
  const testApp = await createTestApp();
  await testApp.app.inject({
    method: "POST",
    url: "/api/auth/magic-link",
    payload: { email: EMAIL, surface: "web", anonymousId: ANONYMOUS_ID },
  });

  await signIn(testApp, testApp.mailer.lastToken());

  assert.deepEqual(testApp.eventSink.links, []);
  assert.deepEqual(await testApp.sql.query("select anonymous_id from magic_links"), [{ anonymous_id: null }]);
  await testApp.close();
});

test("an anonymous id that isn't a random id is refused before anything is sent", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/magic-link",
    payload: { email: EMAIL, surface: "web", intent: "createAccount", anonymousId: "reader@example.com" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(testApp.mailer.sent.length, 0);
  await testApp.close();
});

test("the analytics service being down never fails creating the account", async () => {
  const testApp = await createTestApp();
  testApp.eventSink.failing = true;
  await askToCreateSharing(testApp, "web");

  const response = await signIn(testApp, testApp.mailer.lastToken());

  assert.equal(response.statusCode, 200);
  await testApp.close();
});
