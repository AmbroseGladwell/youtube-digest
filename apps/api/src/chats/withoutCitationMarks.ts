// The model sometimes writes cited ids into the text too, "[p28–p30]"; citations carry them, so they go.
const OWN_ID = String.raw`(?:(?:p|kp|step|apply|dubious|ch|ing|method)\d+|c\d+\.m\d+|verdict|sells|anyway)`;
const SEPARATOR = String.raw`(?:\s|[,;–—-]|\band\b)`;
// Library labels (O3) only where they can be one: in an overview's chat "(O2)" is oxygen.
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
