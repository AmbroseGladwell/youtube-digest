const REACT_SWAP = /\$R([CS])\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
const COMMENT_NODE = 8;
const BOUNDARY_OPENS = new Set(["$", "$?", "$!", "$~"]);
const BOUNDARY_CLOSES = "/$";

interface Swap {
  completes: "C" | "S";
  firstId: string;
  secondId: string;
}

const swapsIn = (document: Document): Swap[] =>
  Array.from(document.querySelectorAll("script")).flatMap((script) =>
    [...(script.textContent ?? "").matchAll(REACT_SWAP)].map(([, completes, firstId, secondId]) => ({
      completes: completes as Swap["completes"],
      firstId: firstId!,
      secondId: secondId!,
    })),
  );

const isComment = (node: ChildNode, data: (text: string) => boolean): boolean =>
  node.nodeType === COMMENT_NODE && data((node as Comment).data);

const fallbackAfter = (marker: Element): ChildNode[] | null => {
  const nodes: ChildNode[] = [];
  let depth = 0;
  for (let node = marker.nextSibling; node !== null; node = node.nextSibling) {
    if (isComment(node, (text) => text === BOUNDARY_CLOSES)) {
      if (depth === 0) {
        return nodes;
      }
      depth -= 1;
    } else if (isComment(node, (text) => BOUNDARY_OPENS.has(text))) {
      depth += 1;
    }
    nodes.push(node);
  }
  return null;
};

const moveChildrenBefore = (from: Element, before: ChildNode) => {
  while (from.firstChild !== null) {
    before.parentNode!.insertBefore(from.firstChild, before);
  }
};

const completeBoundary = (document: Document, boundaryId: string, segmentId: string) => {
  const marker = document.getElementById(boundaryId);
  const segment = document.getElementById(segmentId);
  const fallback = marker === null ? null : fallbackAfter(marker);
  if (marker === null || segment === null || fallback === null) {
    return;
  }
  for (const node of fallback) {
    node.remove();
  }
  moveChildrenBefore(segment, marker);
  marker.remove();
  segment.remove();
};

const completeSegment = (document: Document, segmentId: string, placeholderId: string) => {
  const placeholder = document.getElementById(placeholderId);
  const segment = document.getElementById(segmentId);
  if (placeholder === null || segment === null) {
    return;
  }
  moveChildrenBefore(segment, placeholder);
  placeholder.remove();
  segment.remove();
};

// Why: docs/features/pasted-article-links.md, "Pages that stream in".
export const revealStreamedContent = (document: Document): Document => {
  for (const { completes, firstId, secondId } of swapsIn(document)) {
    if (completes === "C") {
      completeBoundary(document, firstId, secondId);
    } else {
      completeSegment(document, firstId, secondId);
    }
  }
  return document;
};
