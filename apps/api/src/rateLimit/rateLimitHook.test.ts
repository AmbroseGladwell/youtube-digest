import test from "node:test";
import assert from "node:assert/strict";
import type { LightMyRequestResponse } from "fastify";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import type { RateLimit } from "./RateLimit.js";
import { rateLimits } from "./rateLimits.js";

const HOME = "198.51.100.10";
const ELSEWHERE = "198.51.100.20";

const handshake = (testApp: TestApp, remoteAddress = HOME, headers: Record<string, string> = {}) =>
  testApp.app.inject({ method: "GET", url: "/api/handshake", remoteAddress, headers });

const askForLink = (testApp: TestApp, email: string, remoteAddress = HOME) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", remoteAddress, payload: { email, surface: "web" } });

const signIn = (testApp: TestApp, remoteAddress = HOME) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/sign-in", remoteAddress, payload: { token: "not-a-real-token" } });

const exchange = (testApp: TestApp, remoteAddress = HOME) =>
  testApp.app.inject({ method: "POST", url: "/api/auth/link-code", remoteAddress, payload: { code: "ABCD-EFGH" } });

const spend = async (
  { limit }: RateLimit,
  request: (index: number) => Promise<LightMyRequestResponse>,
): Promise<LightMyRequestResponse[]> => {
  const responses: LightMyRequestResponse[] = [];
  for (let index = 0; index < limit; index += 1) {
    responses.push(await request(index));
  }
  return responses;
};

const assertThrottled = (response: LightMyRequestResponse) => {
  assert.equal(response.statusCode, 429);
  assert.equal(response.json().error.code, "too_many_requests");
  const retryAfter = Number(response.headers["retry-after"]);
  assert.ok(Number.isInteger(retryAfter) && retryAfter > 0, `Retry-After was ${response.headers["retry-after"]}`);
  assert.equal(response.json().error.details.retryAfterSeconds, retryAfter);
};

test("an address past its limit is refused with a 429 and a Retry-After, and let back in when it runs out", async () => {
  const testApp = await createTestApp();
  const allowed = await spend(rateLimits.perAddress, () => handshake(testApp));
  assert.ok(allowed.every((response) => response.statusCode === 200));

  const refused = await handshake(testApp);
  assertThrottled(refused);

  testApp.clock.advance(Number(refused.headers["retry-after"]) * 1000);
  assert.equal((await handshake(testApp)).statusCode, 200);
  await testApp.close();
});

test("one address's flood leaves another address alone", async () => {
  const testApp = await createTestApp();
  await spend(rateLimits.perAddress, () => handshake(testApp));

  assert.equal((await handshake(testApp, ELSEWHERE)).statusCode, 200);
  await testApp.close();
});

test("a flood of unknown tokens is refused by its address, with no account to count against", async () => {
  const testApp = await createTestApp();
  const bogus = { authorization: "Bearer not-a-session" };
  await spend(rateLimits.perAddress, () =>
    testApp.app.inject({ method: "GET", url: "/api/session", remoteAddress: HOME, headers: bogus }),
  );

  const refused = await testApp.app.inject({ method: "GET", url: "/api/session", remoteAddress: HOME, headers: bogus });

  assertThrottled(refused);
  await testApp.close();
});

test("behind the proxy, the configured header names the caller rather than the socket", async () => {
  const testApp = await createTestApp({ clientIpHeader: "fly-client-ip" });
  await spend(rateLimits.perAddress, () => handshake(testApp, HOME, { "fly-client-ip": "203.0.113.1" }));

  assertThrottled(await handshake(testApp, HOME, { "fly-client-ip": "203.0.113.1" }));
  assert.equal((await handshake(testApp, HOME, { "fly-client-ip": "203.0.113.2" })).statusCode, 200);
  await testApp.close();
});

test("with no header configured, a client cannot pick its own address by sending one", async () => {
  const testApp = await createTestApp();
  await spend(rateLimits.perAddress, (index) => handshake(testApp, HOME, { "fly-client-ip": `203.0.113.${index % 250}` }));

  assertThrottled(await handshake(testApp, HOME, { "fly-client-ip": "203.0.113.251" }));
  await testApp.close();
});

test("an account past its limit is refused, from any address, and another account is not", async () => {
  const testApp = await createTestApp();
  const busy = await makeSession(testApp.sql, { now: testApp.clock.now });
  const quiet = await makeSession(testApp.sql, { now: testApp.clock.now });
  const whoAmI = (headers: Record<string, string>, remoteAddress: string) =>
    testApp.app.inject({ method: "GET", url: "/api/session", remoteAddress, headers });
  await spend(rateLimits.perAccount, (index) => whoAmI(busy.headers, index % 2 === 0 ? HOME : ELSEWHERE));

  assertThrottled(await whoAmI(busy.headers, "198.51.100.30"));
  assert.equal((await whoAmI(quiet.headers, HOME)).statusCode, 200);
  await testApp.close();
});

test("one address asking for links for many inboxes is refused past its limit", async () => {
  const testApp = await createTestApp();
  const asked = await spend(rateLimits.magicLinkPerAddress, (index) => askForLink(testApp, `reader${index}@example.com`));
  assert.ok(asked.every((response) => response.statusCode === 202));

  assertThrottled(await askForLink(testApp, "one-more@example.com"));
  assert.equal(testApp.mailer.sent.length, rateLimits.magicLinkPerAddress.limit);
  await testApp.close();
});

test("one inbox asked for from many addresses is refused past its limit, however the address is written", async () => {
  const testApp = await createTestApp();
  await spend(rateLimits.magicLinkPerEmail, (index) => askForLink(testApp, "reader@example.com", `203.0.113.${index + 1}`));

  assertThrottled(await askForLink(testApp, " Reader@Example.com ", "203.0.113.200"));
  assert.equal((await askForLink(testApp, "someone-else@example.com", "203.0.113.200")).statusCode, 202);
  await testApp.close();
});

test("a malformed request for a link is still counted against its address", async () => {
  const testApp = await createTestApp();
  await spend(rateLimits.magicLinkPerAddress, () =>
    testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", remoteAddress: HOME, payload: { email: 7 } }),
  );

  assertThrottled(await askForLink(testApp, "reader@example.com"));
  await testApp.close();
});

test("guessing sign-in tokens from one address is refused past its limit", async () => {
  const testApp = await createTestApp();
  const guesses = await spend(rateLimits.signInPerAddress, () => signIn(testApp));
  assert.ok(guesses.every((response) => response.json().error.code === "link_invalid"));

  assertThrottled(await signIn(testApp));
  assert.equal((await signIn(testApp, ELSEWHERE)).json().error.code, "link_invalid");
  await testApp.close();
});

test("guessing link codes from one address is refused past its limit", async () => {
  const testApp = await createTestApp();
  const guesses = await spend(rateLimits.linkCodePerAddress, () => exchange(testApp));
  assert.ok(guesses.every((response) => response.json().error.code === "link_invalid"));

  assertThrottled(await exchange(testApp));
  await testApp.close();
});

test("a reader signing in the ordinary way is never near a limit", async () => {
  const testApp = await createTestApp();
  await askForLink(testApp, "reader@example.com");
  testApp.clock.advance(2 * 60 * 1000);
  await askForLink(testApp, "reader@example.com");

  const signedIn = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/sign-in",
    remoteAddress: HOME,
    payload: { token: testApp.mailer.lastToken() },
  });

  assert.equal(signedIn.statusCode, 200);
  await testApp.close();
});
