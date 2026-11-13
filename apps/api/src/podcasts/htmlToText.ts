import { Parser } from "htmlparser2";

const BREAKS = new Set(["p", "br", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr"]);
const MOST_CHARACTERS = 20_000;

export function htmlToText(html: string): string {
  let text = "";
  const parser = new Parser(
    {
      ontext(chunk) {
        text += chunk;
      },
      onopentag(name) {
        if (BREAKS.has(name)) text += "\n";
      },
      onclosetag(name) {
        if (BREAKS.has(name)) text += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, MOST_CHARACTERS);
}
