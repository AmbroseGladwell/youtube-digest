import { fileURLToPath } from "node:url";

const TRELLO_API = "https://api.trello.com/1";

const TITLE_CARD = /^\s*OV-(\d+)\b/i;
const BRANCH_CARD = /^ov-(\d+)(?:-|$)/i;
const CLOSES_LINE = /^[ \t]*(?:[-*][ \t]+)?closes[ \t]+(?:OV-(\d+)\b|https:\/\/trello\.com\/c\/([A-Za-z0-9]{8}))/gim;

export function cardReferencesIn({ title, body, branch } = {}) {
  const titleNumber = title?.match(TITLE_CARD)?.[1];
  const branchNumber = branch?.match(BRANCH_CARD)?.[1];
  const closing = [...(body ?? "").matchAll(CLOSES_LINE)];
  const cardNumbers = [titleNumber, branchNumber, ...closing.map((match) => match[1])].filter(Boolean).map(Number);
  const shortLinks = closing.map((match) => match[2]).filter(Boolean);
  const warnings =
    titleNumber && branchNumber && Number(titleNumber) !== Number(branchNumber)
      ? [`The title names OV-${Number(titleNumber)} but the branch names OV-${Number(branchNumber)}, so both move`]
      : [];
  return { shortLinks: [...new Set(shortLinks)], cardNumbers: [...new Set(cardNumbers)], warnings };
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
  const { shortLinks, cardNumbers, warnings } = cardReferencesIn({ title: PR_TITLE, body: PR_BODY, branch: PR_BRANCH });
  for (const warning of warnings) console.log(`::warning::${warning}`);
  const referenced = shortLinks.length + cardNumbers.length;
  if (referenced === 0) {
    console.log(
      "No leading OV-n in the PR's title, no leading ov-n- in its branch and no Closes line in its description, so no card moves.",
    );
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
