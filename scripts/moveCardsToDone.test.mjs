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

test("card links are found anywhere in a PR description, once each", () => {
  const body = [
    "Trello: https://trello.com/c/jzBBw0A9/5-transcripts-sometimes-missing",
    "Also https://trello.com/c/LaDH3sgN and again https://trello.com/c/jzBBw0A9",
    "The board https://trello.com/b/yArQIL27/the-overview-backlog is not a card",
  ].join("\n");
  assert.deepEqual(cardReferencesIn(body).shortLinks, ["jzBBw0A9", "LaDH3sgN"]);
});

test("OV numbers are found in the title, description and branch, in any case, once each", () => {
  const references = cardReferencesIn("OV-5: Rest transcripts on refetch failure", "Also closes OV-20.", "ov-5-transcripts-missing");
  assert.deepEqual(references.cardNumbers, [5, 20]);
});

test("OV inside another word is not a card number", () => {
  assert.deepEqual(cardReferencesIn("improv-5 and MOV-3").cardNumbers, []);
});

test("a PR with nothing in it references no cards", () => {
  assert.deepEqual(cardReferencesIn(undefined, "", null), { shortLinks: [], cardNumbers: [] });
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
