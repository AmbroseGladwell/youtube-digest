// The model sometimes writes the ids it cites into the answer as well, "[p28–p30]",
// "(p24)" or "[kp4] [apply1]". Citations already carry them, so the text drops them: the ids
// of transcript passages, of the overview's items (overviewParts), of other chats' messages, and
// of other overviews and their items (S2, S2.kp1).
const OWN_ID = String.raw`(?:(?:p|kp|step|apply|dubious|ch|ing|method)\d+|c\d+\.m\d+|verdict|sells|anyway)`;
const ID = String.raw`(?:(?:S\d+\.)?${OWN_ID}|S\d+)`;
const SEPARATOR = String.raw`(?:\s|[,;–—-]|\band\b)`;
const IDS = String.raw`${ID}(?:${SEPARATOR}+(?:${ID}|\d+))*`;
// A bracket of ids, or one left holding only separators once the ids were taken out, "(;)".
const MARK = new RegExp(String.raw`\s*[\[(](?!\s*[\])])${SEPARATOR}*(?:${IDS})?${SEPARATOR}*[\])]`, "g");
// While the reply arrives, a mark may be cut in half, and the space before it may belong to it.
const CUT_MARK = /\s*[[(][\w.,;–—\- ]{0,40}$|\s+$/;

export function withoutCitationMarks(text: string, { arriving = false } = {}): string {
  const whole = text.replace(MARK, "").replace(/ {2,}/g, " ");
  return arriving ? whole.replace(CUT_MARK, "") : whole.trim();
}
