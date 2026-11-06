import { createSign } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extensionIdFrom } from "./extensionId.mjs";
import { storeZipName } from "./packExtension.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://chromewebstore.googleapis.com";
const UPLOAD_SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const UPLOAD_POLL_ATTEMPTS = 40;
const UPLOAD_POLL_MS = 15_000;

// The two values the store's API needs, both GitHub's rather than Bitwarden's, because a
// runner can only read GitHub's secrets (docs/conventions/secrets.md's exception, as
// FLY_API_TOKEN already is). A service account rather than an installed OAuth client: v2
// takes one, and it has no consent screen to leave in testing, where Google expires a
// refresh token after seven days (docs/architecture/store-listing.md).
export const CREDENTIAL_NAMES = ["CHROME_PUBLISHER_ID", "CHROME_SERVICE_ACCOUNT_KEY"];

const TOKEN_LIFETIME_SECONDS = 3600;

// The JSON key Google Cloud issues, which carries far more than is needed here.
export function serviceAccountFrom(raw) {
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("CHROME_SERVICE_ACCOUNT_KEY is not JSON: it is the whole key file Google Cloud downloads");
  }
  const clientEmail = key.client_email;
  const privateKey = key.private_key;
  if (typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new Error("CHROME_SERVICE_ACCOUNT_KEY carries no client_email and private_key, so it is not a service account key");
  }
  if (!clientEmail.endsWith(".iam.gserviceaccount.com")) {
    throw new Error(`${clientEmail} is not a service account address: the dashboard's Service account field takes the one Google Cloud generates`);
  }
  return { clientEmail, privateKey };
}

// What the assertion claims: this account, asking for this scope, for an hour.
export function assertionClaim({ clientEmail, now }) {
  const issued = Math.floor(now / 1000);
  return {
    iss: clientEmail,
    scope: UPLOAD_SCOPE,
    aud: TOKEN_URL,
    iat: issued,
    exp: issued + TOKEN_LIFETIME_SECONDS,
  };
}

const base64url = (value) => Buffer.from(value).toString("base64url");

// A service account proves itself by signing its own claim rather than by holding a token
// somebody minted for it, which is the whole reason it cannot quietly expire.
export function signedAssertion({ clientEmail, privateKey, now = Date.now() }) {
  const body = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(JSON.stringify(assertionClaim({ clientEmail, now }))),
  ].join(".");
  const signature = createSign("RSA-SHA256").update(body).end().sign(privateKey).toString("base64url");
  return `${body}.${signature}`;
}

export function missingCredentials(env) {
  return CREDENTIAL_NAMES.filter((name) => (env[name] ?? "") === "");
}

export function itemPath({ publisherId, itemId }) {
  return `publishers/${publisherId}/items/${itemId}`;
}

const stateOf = (revision) => revision?.state ?? null;

const versionsOf = (revision) =>
  (revision?.distributionChannels ?? []).map((channel) => channel.crxVersion).filter((version) => version != null);

const spell = (versions) => (versions.length === 0 ? "(no version)" : versions.join(", "));

// What to do with the item as the store currently holds it: the version already published is
// nothing to do, and a submission already in review is not something to overwrite from CI
// (docs/architecture/store-listing.md, "What CI does").
export function submissionDecision(status, version) {
  if (status.takenDown === true) {
    return { publish: false, problem: "the store has taken the item down; the dashboard says why" };
  }
  const published = status.publishedItemRevisionStatus;
  const submitted = status.submittedItemRevisionStatus;
  if (versionsOf(published).includes(version)) {
    return { publish: false, reason: `the store already publishes ${version}` };
  }
  if (stateOf(submitted) === "PENDING_REVIEW") {
    const held = spell(versionsOf(submitted));
    return versionsOf(submitted).includes(version)
      ? { publish: false, reason: `the store is already reviewing ${version}` }
      : {
          publish: false,
          problem: `the store is still reviewing ${held}, so ${version} cannot be submitted behind it: wait for that review, or cancel the submission in the dashboard`,
        };
  }
  if (stateOf(submitted) === "STAGED") {
    return {
      publish: false,
      problem: `the store holds an approved but unreleased ${spell(versionsOf(submitted))}: release it in the dashboard before submitting ${version}`,
    };
  }
  return { publish: true, reason: `the store publishes ${spell(versionsOf(published))}` };
}

// The store answers an upload with the state it reached and the version it read out of the
// manifest inside the zip, and both have to be the release's before anything is submitted.
export function uploadProblem(upload, version) {
  if (upload.uploadState !== "SUCCEEDED") {
    return `the store left the upload in ${upload.uploadState ?? "(no state)"}`;
  }
  if (upload.crxVersion !== version) {
    return `the store read version ${upload.crxVersion ?? "(none)"} out of the zip, not ${version}`;
  }
  return null;
}

const SUBMITTED_STATES = new Set(["PENDING_REVIEW", "STAGED", "PUBLISHED", "PUBLISHED_TO_TESTERS"]);

export function publishProblem(published) {
  return SUBMITTED_STATES.has(published.state)
    ? null
    : `the store put the submission in ${published.state ?? "(no state)"}`;
}

// Read back rather than believed: a publish call that answered is not a submission the store
// says it holds (CLAUDE.md, "Verify before reporting").
export function acceptedProblem(status, version) {
  const submitted = status.submittedItemRevisionStatus;
  const published = status.publishedItemRevisionStatus;
  if (versionsOf(published).includes(version)) return null;
  if (submitted === undefined || submitted === null) {
    return `the store holds no submitted revision of ${version} after the publish`;
  }
  if (!versionsOf(submitted).includes(version)) {
    return `the store's submitted revision is ${spell(versionsOf(submitted))}, not ${version}`;
  }
  return SUBMITTED_STATES.has(stateOf(submitted))
    ? null
    : `the store holds ${version} in ${stateOf(submitted) ?? "(no state)"}`;
}

export function warningLines(published) {
  return (published.warningInfo?.warnings ?? []).map(
    ({ reason, description }) => `${reason ?? "warning"}: ${description ?? "(no description)"}`,
  );
}

async function answerOf(response, what) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${what} was refused with ${response.status}: ${body.trim() || "(empty body)"}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${what} answered with something that is not JSON: ${body.slice(0, 200)}`);
  }
}

// The store's API over fetch, kept behind this seam so the orchestration below can be tested
// without one (scripts/publishExtension.test.mjs).
export function storeApi({ credentials, fetch: doFetch = fetch }) {
  const name = itemPath({ publisherId: credentials.CHROME_PUBLISHER_ID, itemId: credentials.itemId });
  let token = null;

  const authorized = async () => {
    if (token !== null) return token;
    const answer = await answerOf(
      await doFetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: signedAssertion(credentials.serviceAccount),
        }),
      }),
      "the exchange of the signed assertion for an access token",
    );
    if (typeof answer.access_token !== "string") {
      throw new Error("the token exchange answered without an access token");
    }
    if (typeof answer.scope === "string" && !answer.scope.split(" ").includes(UPLOAD_SCOPE)) {
      throw new Error(`the access token does not carry ${UPLOAD_SCOPE}, so it cannot publish`);
    }
    token = answer.access_token;
    return token;
  };

  const call = async (url, what, init = {}) =>
    answerOf(
      await doFetch(url, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${await authorized()}` },
      }),
      what,
    );

  return {
    status: () => call(`${API_ROOT}/v2/${name}:fetchStatus`, "the read of the item's status"),
    upload: (zip) =>
      call(`${API_ROOT}/upload/v2/${name}:upload`, "the upload of the package", {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: zip,
      }),
    publish: () =>
      call(`${API_ROOT}/v2/${name}:publish`, "the submission for review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
      }),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// An upload the store is still unpacking answers IN_PROGRESS and finishes asynchronously, so
// the item's own status is what says how it ended.
async function settledUpload(api, started, { wait = sleep } = {}) {
  if (started.uploadState !== "IN_PROGRESS") return started;
  for (let attempt = 0; attempt < UPLOAD_POLL_ATTEMPTS; attempt += 1) {
    await wait(UPLOAD_POLL_MS);
    const status = await api.status();
    if (status.lastAsyncUploadState === "IN_PROGRESS") continue;
    const versions = versionsOf(status.submittedItemRevisionStatus);
    return { uploadState: status.lastAsyncUploadState, crxVersion: versions.at(-1) ?? started.crxVersion };
  }
  throw new Error("the store was still unpacking the upload after it was given every chance to finish");
}

export async function publishExtension({ api, zip, version, log = console.log, wait = sleep }) {
  const before = await api.status();
  const decision = submissionDecision(before, version);
  if (decision.problem !== undefined) throw new Error(decision.problem);
  if (!decision.publish) {
    log(`chrome web store: nothing to submit, because ${decision.reason}`);
    return { submitted: false, reason: decision.reason };
  }
  log(`chrome web store: submitting ${version}, where ${decision.reason}`);

  const upload = await settledUpload(api, await api.upload(zip), { wait });
  const refused = uploadProblem(upload, version);
  if (refused !== null) throw new Error(`the package was not taken: ${refused}`);
  log(`chrome web store: the store took ${upload.crxVersion}`);

  const published = await api.publish();
  for (const line of warningLines(published)) log(`chrome web store warning: ${line}`);
  const rejected = publishProblem(published);
  if (rejected !== null) throw new Error(`the submission was not accepted: ${rejected}`);

  const after = await api.status();
  const unproven = acceptedProblem(after, version);
  if (unproven !== null) throw new Error(`the submission cannot be confirmed: ${unproven}`);
  const state = stateOf(after.submittedItemRevisionStatus) ?? stateOf(after.publishedItemRevisionStatus);
  log(`chrome web store: the store holds ${version} in ${state}`);
  return { submitted: true, state };
}

function reportCredentials(env) {
  const missing = missingCredentials(env);
  if (missing.length > 0) {
    console.log(`::warning::${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} set, so the extension wasn't submitted to the Chrome Web Store`);
  }
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `ready=${missing.length === 0}\n`);
  return missing.length === 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [mode, given] = process.argv.slice(2);
  if (!["credentials", "submit"].includes(mode)) {
    console.error("usage: node scripts/publishExtension.mjs credentials | submit [version]");
    process.exit(2);
  }
  try {
    // Saying so and skipping, rather than failing main over a secret nobody has set yet:
    // the deploy that made the release still happened (docs/architecture/deploy.md).
    if (mode === "credentials") {
      reportCredentials(process.env);
      process.exit(0);
    }
    const version = given ?? JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8")).version;
    const missing = missingCredentials(process.env);
    if (missing.length > 0) throw new Error(`${missing.join(", ")} missing from the environment`);
    const manifest = JSON.parse(readFileSync(path.join(rootDir, "apps/extension/manifest.json"), "utf8"));
    if (typeof manifest.key !== "string" || manifest.key === "") {
      throw new Error("manifest.json carries no key, so there is no store item to submit to");
    }
    const credentials = {
      CHROME_PUBLISHER_ID: process.env.CHROME_PUBLISHER_ID,
      serviceAccount: serviceAccountFrom(process.env.CHROME_SERVICE_ACCOUNT_KEY),
      itemId: extensionIdFrom(manifest.key),
    };
    const zip = readFileSync(path.join(rootDir, "apps/extension/release", storeZipName(version)));
    await publishExtension({ api: storeApi({ credentials }), zip, version });
  } catch (error) {
    console.error(`chrome web store: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
