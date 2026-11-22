const DIRECTIVE = /^\s*(@ts-|oxlint-|eslint-|@vite-ignore|webpackChunkName|c8 |istanbul |\/ <reference|#region|#endregion)/;
const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;

const runsOf = (comments, sourceCode) => {
  const runs = [];
  for (const comment of comments) {
    const startLine = sourceCode.getLocFromIndex(comment.range[0]).line;
    const endLine = sourceCode.getLocFromIndex(comment.range[1]).line;
    const previous = runs.at(-1);
    const between = previous ? sourceCode.text.slice(previous.end, comment.range[0]) : "";
    if (previous && comment.type === "Line" && previous.type === "Line" && /^[ \t]*\r?\n[ \t]*$/.test(between)) {
      previous.end = comment.range[1];
      previous.endLine = endLine;
      continue;
    }
    runs.push({ type: comment.type, start: comment.range[0], end: comment.range[1], startLine, endLine });
  }
  return runs;
};

export const noLongComment = {
  meta: {
    type: "suggestion",
    docs: { description: "A comment is one line at most, and never a TODO (docs/conventions/commenting.md)." },
    messages: {
      long: "A comment is one line at most. Name it so the comment isn't needed, encode it in a test, or move the reasoning to a doc and point at it (docs/conventions/commenting.md).",
      marker: "No TODO or FIXME comments: the work goes on a Trello card (docs/conventions/commenting.md).",
    },
  },
  create: (context) => ({
    "Program:exit": () => {
      const sourceCode = context.sourceCode;
      const comments = sourceCode.getAllComments().filter((comment) => !DIRECTIVE.test(comment.value));
      for (const comment of comments) {
        if (MARKER.test(comment.value)) {
          context.report({ loc: sourceCode.getLocFromIndex(comment.range[0]), messageId: "marker" });
        }
      }
      for (const run of runsOf(comments, sourceCode)) {
        if (run.endLine > run.startLine) {
          context.report({
            loc: { start: sourceCode.getLocFromIndex(run.start), end: sourceCode.getLocFromIndex(run.end) },
            messageId: "long",
          });
        }
      }
    },
  }),
};
