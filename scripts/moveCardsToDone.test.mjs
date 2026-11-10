import test from "node:test";
import assert from "node:assert/strict";
import { cardReferencesIn, moveCardsToDone } from "./moveCardsToDone.mjs";

const BOARD = "6abb89162c841485996daa9f";
const DONE = "6abb89162c841485996daa9d";
const ELSEWHERE = "6abb89162c841485996daa9c";
const BOARD_CARDS = { 5: "jzBBw0A9", 20: "LaDH3sgN" };

function fakeTrello({ failMoves = [], listAfterMove = DONE } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers });
    const segments = new URL(url).pathname.split("/");
    if (segments.includes("boards")) {
      const shortLink = BOARD_CARDS[segments.pop()];
      return shortLink ? { ok: true, json: async () => ({ shortLink }) } : { ok: false, status: 404 };
    }
    const shortLink = segments.pop();
    if (init.method === "PUT") return { ok: !failMoves.includes(shortLink), status: failMoves.includes(shortLink) ? 401 : 200 };
    return { ok: true, json: async () => ({ idList: listAfterMove, name: `Card ${shortLink}` }) };
  };
  return { fetch, calls };
}

function move(trello, references) {
  return moveCardsToDone({
    shortLinks: [],
    cardNumbers: [],
    ...references,
    boardId: BOARD,
    doneListId: DONE,
    apiKey: "k",
    token: "t",
    fetch: trello.fetch,
  });
}

test("the title's leading OV number is the card a PR moves", () => {
  assert.deepEqual(cardReferencesIn({ title: "OV-5: Rest transcripts on refetch failure" }).cardNumbers, [5]);
});

test("an OV number later in the title does not count", () => {
  assert.deepEqual(cardReferencesIn({ title: "Fix for OV-5" }).cardNumbers, []);
});

test("the branch's leading ov number counts when the title has none", () => {
  assert.deepEqual(cardReferencesIn({ title: "Rest transcripts", branch: "ov-5-transcripts" }).cardNumbers, [5]);
});

test("a title and branch naming the same card move it once, with no warning", () => {
  const references = cardReferencesIn({ title: "OV-5: Rest transcripts", branch: "ov-5-transcripts" });
  assert.deepEqual(references.cardNumbers, [5]);
  assert.deepEqual(references.warnings, []);
});

test("a title and branch naming different cards move both, with a warning", () => {
  const references = cardReferencesIn({ title: "OV-5: Rest transcripts", branch: "ov-20-reused-branch" });
  assert.deepEqual(references.cardNumbers, [5, 20]);
  assert.match(references.warnings[0], /OV-5.*OV-20/);
});

test("cards the description mentions, by number or link, move nothing", () => {
  const body = [
    "Builds on OV-20 (https://trello.com/c/LaDH3sgN/20-something) and unblocks ov-21.",
    "Trello: https://trello.com/c/jzBBw0A9/5-transcripts-sometimes-missing",
    "This closes the gap OV-22 left, and Closes OV-23 mid-line does not count.",
  ].join("\n");
  assert.deepEqual(cardReferencesIn({ title: "OV-5: Rest transcripts", body }), {
    shortLinks: [],
    cardNumbers: [5],
    warnings: [],
  });
});

test("a Closes line in the description moves that card, by number or link, in any case", () => {
  const body = ["Closes OV-20", "- closes https://trello.com/c/LaDH3sgN/20-something", "  CLOSES ov-21.", "Closes OV-20"].join("\n");
  assert.deepEqual(cardReferencesIn({ title: "OV-5: Rest transcripts", body }), {
    shortLinks: ["LaDH3sgN"],
    cardNumbers: [5, 20, 21],
    warnings: [],
  });
});

test("OV inside another word is not a card number", () => {
  assert.deepEqual(
    cardReferencesIn({ title: "improv-5 and MOV-3", body: "Closes MOV-3\nCloses improv-5", branch: "mov-3-x" }).cardNumbers,
    [],
  );
});

test("a PR with nothing in it references no cards", () => {
  assert.deepEqual(cardReferencesIn({ title: undefined, body: "", branch: null }), { shortLinks: [], cardNumbers: [], warnings: [] });
});

test("a card is reported moved only once it reads back in Done", async () => {
  const trello = fakeTrello();
  const results = await move(trello, { shortLinks: ["jzBBw0A9"] });
  assert.deepEqual(results, [{ card: "jzBBw0A9", moved: true, name: "Card jzBBw0A9" }]);
  assert.deepEqual(
    trello.calls.map((call) => call.method),
    ["PUT", "GET"],
  );
});

test("an OV number is looked up on the board and moved, once even if also linked", async () => {
  const trello = fakeTrello();
  const results = await move(trello, { shortLinks: ["jzBBw0A9"], cardNumbers: [5, 20] });
  assert.deepEqual(
    results.map((result) => [result.card, result.moved]),
    [
      ["jzBBw0A9", true],
      ["LaDH3sgN", true],
    ],
  );
  assert.equal(trello.calls.filter((call) => call.method === "PUT").length, 2);
});

test("an OV number the board does not have is reported, and the rest still move", async () => {
  const trello = fakeTrello();
  const results = await move(trello, { cardNumbers: [99, 5] });
  assert.deepEqual(
    results.map((result) => [result.card, result.moved]),
    [
      ["OV-99", false],
      ["jzBBw0A9", true],
    ],
  );
});

test("a move Trello accepted but did not apply is reported as a failure", async () => {
  const [result] = await move(fakeTrello({ listAfterMove: ELSEWHERE }), { shortLinks: ["jzBBw0A9"] });
  assert.equal(result.moved, false);
  assert.match(result.reason, /did not read back in Done/);
});

test("one refused move does not stop the others", async () => {
  const results = await move(fakeTrello({ failMoves: ["jzBBw0A9"] }), { shortLinks: ["jzBBw0A9", "LaDH3sgN"] });
  assert.deepEqual(
    results.map((result) => [result.card, result.moved]),
    [
      ["jzBBw0A9", false],
      ["LaDH3sgN", true],
    ],
  );
});

test("the credentials travel in a header, never in the URL a log could print", async () => {
  const trello = fakeTrello();
  await moveCardsToDone({
    shortLinks: ["jzBBw0A9"],
    cardNumbers: [20],
    boardId: BOARD,
    doneListId: DONE,
    apiKey: "the-key",
    token: "the-token",
    fetch: trello.fetch,
  });
  for (const call of trello.calls) {
    assert.doesNotMatch(call.url, /the-key|the-token/);
    assert.match(call.headers.Authorization, /oauth_consumer_key="the-key", oauth_token="the-token"/);
  }
});
