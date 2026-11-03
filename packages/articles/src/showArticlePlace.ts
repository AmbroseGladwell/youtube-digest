import type { ArticlePlace } from "@overview/domain";

const collapsed = (text: string): string => text.replace(/\s+/g, " ");

function elementHolding(document: Document, quote: string): Element | null {
  const wanted = collapsed(quote).trim();
  const walker = document.createTreeWalker(document.body, 4);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    nodes.push(node as Text);
    starts.push(text.length);
    text += collapsed(node.textContent ?? "");
  }
  const found = text.indexOf(wanted);
  if (found === -1) return null;
  const nodeIndex = starts.findLastIndex((start) => start <= found);
  return nodes[nodeIndex]?.parentElement ?? null;
}

// Moves the page beside the panel, and says whether the place was there (design 77y). A quote
// can cross inline elements, so it is matched over the page's text rather than one node's.
export function showArticlePlace(document: Document, { anchor, quote }: ArticlePlace): boolean {
  const target = (anchor === null ? null : document.getElementById(anchor)) ?? elementHolding(document, quote);
  target?.scrollIntoView({ block: "center" });
  return target !== null && target !== undefined;
}
