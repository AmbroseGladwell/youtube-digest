import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_PAYLOAD_ELEMENT_ID, type Overview, type Share } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { createTestApp, TEST_APP_URL, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";

const NARRATION = { key: "b".repeat(64), voice: "bf_emma", durationSeconds: 364, lineStartsSeconds: [0, 12.5] };

const publish = async (account: TestAccount, overview: Overview, narration: unknown = null): Promise<Share> => {
  const response = await account.inject({ method: "POST", url: "/api/shares", body: { overview, narration } });
  assert.equal(response.statusCode, 201);
  return response.json();
};

const payloadOf = (html: string): Record<string, unknown> => {
  const match = html.match(new RegExp(`<script id="${SHARE_PAYLOAD_ELEMENT_ID}"[^>]*>([\\s\\S]*?)</script>`));
  assert.notEqual(match, null, "the page carries no payload");
  return JSON.parse(match![1]!.replace(/\\u003c/g, "<"));
};

const reader = async (): Promise<{ app: TestApp; account: TestAccount }> => {
  const app = await createTestApp();
  return { app, account: await makeAccount(app) };
};

test("the page a link opens carries the preview a chat app reads", async () => {
  const { app, account } = await reader();
  const made = await publish(
    account,
    makeOverview({
      video: { ...makeOverview().video, title: "The Quiet Return of Nuclear Baseload", durationMs: 842_000 },
      inOneLine: "Nuclear is back on the plans because firm capacity became expensive.",
    }),
    NARRATION,
  );

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /text\/html/);
  assert.match(response.body, /<title>The Quiet Return of Nuclear Baseload · The Overview<\/title>/);
  assert.match(response.body, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(response.body, /<meta property="og:title" content="The Quiet Return of Nuclear Baseload">/);
  assert.match(
    response.body,
    /<meta property="og:description" content="1 min read · 1 min listen · 14:02 video\. Nuclear is back on the plans because firm capacity became expensive\.">/,
  );
  assert.match(response.body, new RegExp(`<meta property="og:url" content="${TEST_APP_URL}/s/${made.token}">`));
  assert.match(response.body, new RegExp(`<meta property="og:image" content="${TEST_APP_URL}/s/${made.token}/card.png">`));
  assert.match(response.body, new RegExp(`<meta property="og:audio" content="${TEST_APP_URL}/s/${made.token}/audio.mp3">`));
  assert.match(response.body, /<meta name="twitter:card" content="summary_large_image">/);
  await app.close();
});

test("a copy with no narration offers no audio to unfurl", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview());

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });

  assert.equal(response.body.includes("og:audio"), false);
  await app.close();
});

test("nothing the reader wrote for themselves is in the page", async () => {
  const { app, account } = await reader();
  const made = await publish(
    account,
    makeOverview({
      captureReason: "Read before the Thursday review.",
      tags: ["energy-policy", "nuclear", "grids"],
      verdict: {
        novelty: "recycled",
        dubious: true,
        reasoning: "Every claim here is secondhand.",
        similarTo: [],
      },
    }),
  );

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });
  const payload = payloadOf(response.body);

  assert.equal(response.body.includes("Read before the Thursday review."), false);
  assert.equal(JSON.stringify(payload).includes("captureReason"), false);
  assert.equal(JSON.stringify(payload).includes("topicIds"), false);
  // Tags travel with the note rather than with the reader: the design's own "Kept private"
  // list does not claim otherwise, and a copy without them could not be saved at all.
  assert.match(JSON.stringify(payload), /energy-policy/);
  await app.close();
});

test("a blunt verdict is in the copy but never in the preview a chat app shows", async () => {
  const { app, account } = await reader();
  const made = await publish(
    account,
    makeOverview({
      verdict: { novelty: "recycled", dubious: true, reasoning: "Every claim here is secondhand.", similarTo: [] },
    }),
  );

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });
  const head = response.body.slice(0, response.body.indexOf(`<script id="${SHARE_PAYLOAD_ELEMENT_ID}"`));

  assert.equal(head.includes("Every claim here is secondhand."), false);
  assert.match(JSON.stringify(payloadOf(response.body)), /Every claim here is secondhand\./);
  await app.close();
});

test("a stopped link says so, straight away, and says nothing about what was there", async () => {
  const { app, account } = await reader();
  const made = await publish(
    account,
    makeOverview({ video: { ...makeOverview().video, title: "The Quiet Return of Nuclear Baseload" } }),
  );
  await account.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });

  assert.equal(response.statusCode, 410);
  assert.equal(response.body.includes("The Quiet Return of Nuclear Baseload"), false);
  assert.equal(payloadOf(response.body).state, "revoked");
  await app.close();
});

test("a link that was never issued is not found, rather than pretending to have been stopped", async () => {
  const { app } = await reader();

  const response = await app.app.inject({ method: "GET", url: "/s/AAAAAAAAAAAAAAAA" });

  assert.equal(response.statusCode, 404);
  assert.equal(payloadOf(response.body).state, "unknown");
  await app.close();
});

test("views count one per opening, and a preview fetching the card and the audio counts none", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview(), NARRATION);

  await app.app.inject({ method: "GET", url: `/s/${made.token}` });
  await app.app.inject({ method: "GET", url: `/s/${made.token}` });
  await app.app.inject({ method: "GET", url: `/s/${made.token}/card.png` });
  await app.app.inject({ method: "GET", url: `/s/${made.token}/audio.mp3` });

  const listed = await account.inject({ method: "GET", url: "/api/shares" });
  assert.equal(listed.json().shares[0].views, 2);
  await app.close();
});

test("a stopped link stops counting", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview());
  await app.app.inject({ method: "GET", url: `/s/${made.token}` });
  await account.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  await app.app.inject({ method: "GET", url: `/s/${made.token}` });

  const rows = await app.sql.query<{ views: string }>("select views from shares where token = $1", [made.token]);
  assert.equal(Number(rows[0]!.views), 1);
  await app.close();
});

test("the audio address points at the render every other player uses", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview(), NARRATION);

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}/audio.mp3` });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, `/api/audio/${NARRATION.key}/file`);
  await app.close();
});

test("there is no audio address for a copy shared without narration", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview());

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}/audio.mp3` });

  assert.equal(response.statusCode, 404);
  await app.close();
});

test("the card is a PNG of the size every unfurler crops to", async () => {
  const { app, account } = await reader();
  const made = await publish(
    account,
    makeOverview({ video: { ...makeOverview().video, title: "The Quiet Return of Nuclear Baseload" } }),
  );

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}/card.png` });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "image/png");
  const png = response.rawPayload;
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  await app.close();
});

test("a stopped link's card is gone too, so a preview cached nowhere can resurrect it", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview());
  await account.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}/card.png` });

  assert.equal(response.statusCode, 410);
  await app.close();
});

test("the page is never cached, so stopping a link is not undone by a stale copy", async () => {
  const { app, account } = await reader();
  const made = await publish(account, makeOverview());

  const response = await app.app.inject({ method: "GET", url: `/s/${made.token}` });

  assert.equal(response.headers["cache-control"], "no-store");
  await app.close();
});
