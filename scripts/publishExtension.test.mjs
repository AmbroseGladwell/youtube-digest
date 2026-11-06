import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  acceptedProblem,
  assertionClaim,
  itemPath,
  missingCredentials,
  serviceAccountFrom,
  signedAssertion,
  publishExtension,
  publishProblem,
  submissionDecision,
  uploadProblem,
  warningLines,
} from "./publishExtension.mjs";

const VERSION = "0.4.0";
const ZIP = Buffer.from("not really a zip");

const revision = (state, ...versions) => ({
  state,
  distributionChannels: versions.map((crxVersion) => ({ crxVersion, deployPercentage: 100 })),
});

const published = (...versions) => ({ publishedItemRevisionStatus: revision("PUBLISHED", ...versions) });

// A store that takes the upload, accepts the submission, and then says it holds it.
const happyStore = (overrides = {}) => {
  const calls = [];
  const api = {
    status: async () => {
      calls.push("status");
      return calls.filter((call) => call === "status").length === 1
        ? (overrides.before ?? published("0.3.0"))
        : (overrides.after ?? { ...published("0.3.0"), submittedItemRevisionStatus: revision("PENDING_REVIEW", VERSION) });
    },
    upload: async (zip) => {
      calls.push("upload");
      assert.equal(zip, ZIP);
      return overrides.upload ?? { uploadState: "SUCCEEDED", crxVersion: VERSION };
    },
    publish: async () => {
      calls.push("publish");
      return overrides.published ?? { state: "PENDING_REVIEW" };
    },
  };
  return { api, calls };
};

const submit = (overrides = {}) => {
  const store = happyStore(overrides);
  return publishExtension({ api: store.api, zip: ZIP, version: VERSION, log: () => undefined, wait: async () => undefined })
    .then((result) => ({ ...result, calls: store.calls }));
};

test("the item is addressed by publisher and item id", () => {
  assert.equal(itemPath({ publisherId: "12345", itemId: "abcd" }), "publishers/12345/items/abcd");
});

test("every credential the store needs is named as missing when it is unset or empty", () => {
  assert.deepEqual(missingCredentials({}).length, 2);
  assert.deepEqual(
    missingCredentials({ CHROME_PUBLISHER_ID: "12345", CHROME_SERVICE_ACCOUNT_KEY: "" }),
    ["CHROME_SERVICE_ACCOUNT_KEY"],
  );
});

const KEY_PAIR = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SERVICE_ACCOUNT_EMAIL = "overview-publisher@a-project.iam.gserviceaccount.com";
const KEY_FILE = JSON.stringify({
  type: "service_account",
  client_email: SERVICE_ACCOUNT_EMAIL,
  private_key: KEY_PAIR.privateKey.export({ type: "pkcs8", format: "pem" }),
});

test("the key file is read for the two fields that matter", () => {
  const account = serviceAccountFrom(KEY_FILE);
  assert.equal(account.clientEmail, SERVICE_ACCOUNT_EMAIL);
  assert.match(account.privateKey, /BEGIN PRIVATE KEY/);
});

test("anything that is not a service account key says which part is wrong", () => {
  assert.throws(() => serviceAccountFrom("not json"), /is not JSON/);
  assert.throws(() => serviceAccountFrom("{}"), /no client_email and private_key/);
  assert.throws(
    () => serviceAccountFrom(JSON.stringify({ client_email: "me@gmail.com", private_key: "k" })),
    /not a service account address/,
  );
});

test("the assertion claims this account, this scope, and an hour", () => {
  const now = 1_700_000_000_000;
  const claim = assertionClaim({ clientEmail: SERVICE_ACCOUNT_EMAIL, now });
  assert.equal(claim.iss, SERVICE_ACCOUNT_EMAIL);
  assert.equal(claim.scope, "https://www.googleapis.com/auth/chromewebstore");
  assert.equal(claim.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claim.exp - claim.iat, 3600);
  assert.equal(claim.iat, now / 1000);
});

test("the assertion really is signed by the key, and Google could check it", () => {
  const { clientEmail, privateKey } = serviceAccountFrom(KEY_FILE);
  const jwt = signedAssertion({ clientEmail, privateKey, now: 1_700_000_000_000 });
  const [header, claim, signature] = jwt.split(".");

  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.equal(JSON.parse(Buffer.from(claim, "base64url").toString()).iss, SERVICE_ACCOUNT_EMAIL);
  const verified = createVerify("RSA-SHA256")
    .update(`${header}.${claim}`)
    .end()
    .verify(KEY_PAIR.publicKey, Buffer.from(signature, "base64url"));
  assert.equal(verified, true);
});

test("a version the store already publishes is not submitted again", () => {
  const decision = submissionDecision(published(VERSION), VERSION);
  assert.equal(decision.publish, false);
  assert.match(decision.reason, /already publishes 0\.4\.0/);
});

test("a version already in review is not submitted again", () => {
  const decision = submissionDecision({ submittedItemRevisionStatus: revision("PENDING_REVIEW", VERSION) }, VERSION);
  assert.equal(decision.publish, false);
  assert.equal(decision.problem, undefined);
});

test("another version in review stops the submission rather than queueing behind it", () => {
  const decision = submissionDecision({ submittedItemRevisionStatus: revision("PENDING_REVIEW", "0.3.9") }, VERSION);
  assert.equal(decision.publish, false);
  assert.match(decision.problem, /still reviewing 0\.3\.9/);
});

test("an approved but unreleased revision stops the submission", () => {
  const decision = submissionDecision({ submittedItemRevisionStatus: revision("STAGED", "0.3.9") }, VERSION);
  assert.match(decision.problem, /approved but unreleased/);
});

test("a taken-down item is never submitted to", () => {
  assert.match(submissionDecision({ takenDown: true, ...published("0.3.0") }, VERSION).problem, /taken the item down/);
});

test("a rejected or cancelled earlier submission does not stand in the way", () => {
  for (const state of ["REJECTED", "CANCELLED"]) {
    assert.equal(submissionDecision({ submittedItemRevisionStatus: revision(state, "0.3.9") }, VERSION).publish, true);
  }
});

test("an item with nothing published yet is submitted to", () => {
  const decision = submissionDecision({}, VERSION);
  assert.equal(decision.publish, true);
  assert.match(decision.reason, /\(no version\)/);
});

test("an upload the store did not finish, or read another version out of, is not submitted", () => {
  assert.match(uploadProblem({ uploadState: "FAILED" }, VERSION), /in FAILED/);
  assert.match(uploadProblem({ uploadState: "SUCCEEDED", crxVersion: "0.3.0" }, VERSION), /read version 0\.3\.0/);
  assert.equal(uploadProblem({ uploadState: "SUCCEEDED", crxVersion: VERSION }, VERSION), null);
});

test("only a state the store actually holds the submission in counts as accepted", () => {
  assert.equal(publishProblem({ state: "PENDING_REVIEW" }), null);
  assert.equal(publishProblem({ state: "PUBLISHED" }), null);
  assert.match(publishProblem({ state: "REJECTED" }), /in REJECTED/);
  assert.match(publishProblem({}), /\(no state\)/);
});

test("the read-back proves the store holds this version, not merely some submission", () => {
  assert.equal(acceptedProblem({ submittedItemRevisionStatus: revision("PENDING_REVIEW", VERSION) }, VERSION), null);
  assert.equal(acceptedProblem(published(VERSION), VERSION), null);
  assert.match(acceptedProblem({}, VERSION), /no submitted revision of 0\.4\.0/);
  assert.match(
    acceptedProblem({ submittedItemRevisionStatus: revision("PENDING_REVIEW", "0.3.0") }, VERSION),
    /submitted revision is 0\.3\.0/,
  );
});

test("warnings the store returns are reported rather than swallowed", () => {
  assert.deepEqual(
    warningLines({ warningInfo: { warnings: [{ reason: "PERMISSION", description: "justify tabs" }] } }),
    ["PERMISSION: justify tabs"],
  );
  assert.deepEqual(warningLines({}), []);
});

test("a submission uploads, publishes and reads the store back, in that order", async () => {
  const result = await submit();
  assert.equal(result.submitted, true);
  assert.equal(result.state, "PENDING_REVIEW");
  assert.deepEqual(result.calls, ["status", "upload", "publish", "status"]);
});

test("a version the store already holds is never uploaded", async () => {
  const result = await submit({ before: published(VERSION) });
  assert.equal(result.submitted, false);
  assert.deepEqual(result.calls, ["status"]);
});

test("an upload the store read another version out of is never published", async () => {
  const store = happyStore({ upload: { uploadState: "SUCCEEDED", crxVersion: "0.3.0" } });
  await assert.rejects(
    publishExtension({ api: store.api, zip: ZIP, version: VERSION, log: () => undefined, wait: async () => undefined }),
    /read version 0\.3\.0/,
  );
  assert.ok(!store.calls.includes("publish"));
});

test("a submission the store does not say it holds afterwards fails the job", async () => {
  await assert.rejects(submit({ after: published("0.3.0") }), /cannot be confirmed/);
});

test("an upload still being unpacked is waited out, and the item's own status settles it", async () => {
  const states = ["IN_PROGRESS", "SUCCEEDED"];
  let reads = 0;
  const api = {
    status: async () => {
      reads += 1;
      if (reads === 1) return published("0.3.0");
      const lastAsyncUploadState = states.shift() ?? "SUCCEEDED";
      return {
        ...published("0.3.0"),
        lastAsyncUploadState,
        submittedItemRevisionStatus: revision("PENDING_REVIEW", VERSION),
      };
    },
    upload: async () => ({ uploadState: "IN_PROGRESS" }),
    publish: async () => ({ state: "PENDING_REVIEW" }),
  };

  const result = await publishExtension({
    api,
    zip: ZIP,
    version: VERSION,
    log: () => undefined,
    wait: async () => undefined,
  });

  assert.equal(result.submitted, true);
});
