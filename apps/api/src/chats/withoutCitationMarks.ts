// The model sometimes writes the ids it cites into the answer as well, "[p28–p30]",
// "(p24)" or "[kp4] [apply1]". Citations already carry them, so the text drops them: the ids
// of transcript passages, of the overview's items (overviewParts), of other chats' messages, and
// of other overviews and their items (S2, S2.kp1), and of a library's or project's (O3, O3.kp2).
const OWN_ID = String.raw`(?:(?:p|kp|step|apply|dubious|ch|ing|method)\d+|c\d+\.m\d+|verdict|sells|anyway)`;
const SEPARATOR = String.raw`(?:\s|[,;–—-]|\band\b)`;
// A bracket of ids, or one left holding only separators once the ids were taken out, "(;)". A
// library's or project's labels (O3) only where they can be one: in an overview's chat "(O2)" is oxygen.
const markOf = (labels: string): RegExp => {
  const id = String.raw`(?:(?:[${labels}]\d+\.)?${OWN_ID}|[${labels}]\d+)`;
  const ids = String.raw`${id}(?:${SEPARATOR}+(?:${id}|\d+))*`;
  return new RegExp(String.raw`\s*[\[(](?!\s*[\])])${SEPARATOR}*(?:${ids})?${SEPARATOR}*[\])]`, "g");
};
const MARK = markOf("S");
const LIBRARY_MARK = markOf("SO");
// While the reply arrives, a mark may be cut in half, and the space before it may belong to it.
const CUT_MARK = /\s*[[(][\w.,;–—\- ]{0,40}$|\s+$/;

export const withoutCitationMarks = (text: string, { arriving = false, library = false } = {}): string => {
  const whole = text.replace(library ? LIBRARY_MARK : MARK, "").replace(/ {2,}/g, " ");
  return arriving ? whole.replace(CUT_MARK, "") : whole.trim();
};
