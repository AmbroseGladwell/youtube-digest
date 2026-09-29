import { fileURLToPath } from "node:url";

const TRELLO_API = "https://api.trello.com/1";

export function cardReferencesIn(...texts) {
  const text = texts.filter(Boolean).join("\n");
  const shortLinks = [...text.matchAll(/https:\/\/trello\.com\/c\/([A-Za-z0-9]{8})/g)].map((match) => match[1]);
  const cardNumbers = [...text.matchAll(/\bOV-(\d+)\b/gi)].map((match) => Number(match[1]));
  return { shortLinks: [...new Set(shortLinks)], cardNumbers: [...new Set(cardNumbers)] };
}

export async function moveCardsToDone({ shortLinks, cardNumbers, boardId, doneListId, apiKey, token, fetch }) {
  const headers = {
    Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`,
    Accept: "application/json",
  };
  const results = [];
  const toMove = new Set(shortLinks);
  for (const cardNumber of cardNumbers) {
    const found = await fetch(`${TRELLO_API}/boards/${boardId}/cards/${cardNumber}?fields=shortLink`, { headers });
    if (found.ok) toMove.add((await found.json()).shortLink);
    else results.push({ card: `OV-${cardNumber}`, moved: false, reason: `no card OV-${cardNumber} on the board (${found.status})` });
  }
  for (const shortLink of toMove) {
    const moved = await fetch(`${TRELLO_API}/cards/${shortLink}?idList=${doneListId}`, { method: "PUT", headers });
    if (!moved.ok) {
      results.push({ card: shortLink, moved: false, reason: `move answered ${moved.status}` });
      continue;
    }
    const readBack = await fetch(`${TRELLO_API}/cards/${shortLink}?fields=idList,name`, { headers });
    const card = readBack.ok ? await readBack.json() : null;
    results.push(
      card?.idList === doneListId
        ? { card: shortLink, moved: true, name: card.name }
        : { card: shortLink, moved: false, reason: "the card did not read back in Done" },
    );
  }
  return results;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { PR_TITLE, PR_BODY, PR_BRANCH, TRELLO_BOARD_ID, TRELLO_DONE_LIST_ID, TRELLO_API_KEY, TRELLO_TOKEN } = process.env;
  const { shortLinks, cardNumbers } = cardReferencesIn(PR_TITLE, PR_BODY, PR_BRANCH);
  const referenced = shortLinks.length + cardNumbers.length;
  if (referenced === 0) {
    console.log("No OV-n or Trello card link in the PR's title, description or branch, so no card moves.");
    process.exit(0);
  }
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
    console.log(
      `::warning::The PR references ${referenced} Trello card(s) but TRELLO_API_KEY or TRELLO_TOKEN is not set, so none moved to Done`,
    );
    process.exit(0);
  }
  const results = await moveCardsToDone({
    shortLinks,
    cardNumbers,
    boardId: TRELLO_BOARD_ID,
    doneListId: TRELLO_DONE_LIST_ID,
    apiKey: TRELLO_API_KEY,
    token: TRELLO_TOKEN,
    fetch: globalThis.fetch,
  });
  for (const result of results) {
    console.log(
      result.moved
        ? `Moved "${result.name}" (${result.card}) to Done`
        : `::error::Card ${result.card} was not moved to Done: ${result.reason}`,
    );
  }
  process.exit(results.every((result) => result.moved) ? 0 : 1);
}
