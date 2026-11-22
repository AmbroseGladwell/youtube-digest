import { MAX_ERROR_FRAMES, type ClientErrorFrame } from "@overview/domain";

const V8_FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/;
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)$/;

export type ChunkIds = Readonly<Record<string, string>>;

const bundlePath = (location: string): string | null => {
  try {
    return new URL(location).pathname
      .replace(/^\/+/, "")
      .replace(/[^\w./@~+-]/g, "_")
      .slice(0, 200);
  } catch {
    return null;
  }
};

const locatedFrames = function* (stack: string) {
  for (const line of stack.split("\n")) {
    const match = V8_FRAME.exec(line) ?? GECKO_FRAME.exec(line);
    if (match === null) {
      continue;
    }
    const [, fn = "", location = "", lineNumber = "0", column = "0"] = match;
    const file = bundlePath(location);
    if (file !== null) {
      yield { fn, file, line: Number(lineNumber), column: Number(column) };
    }
  }
};

let cached: { chunkIds: ChunkIds; count: number; byFile: Map<string, string> } | null = null;

// The CLI keys each chunk's id by a stack taken inside it, so the stack's first frame names the file.
const chunkIdsByFile = (chunkIds: ChunkIds | undefined): Map<string, string> => {
  if (chunkIds === undefined) {
    return new Map();
  }
  const count = Object.keys(chunkIds).length;
  if (cached?.chunkIds === chunkIds && cached.count === count) {
    return cached.byFile;
  }
  const byFile = new Map<string, string>();
  for (const [stack, chunkId] of Object.entries(chunkIds)) {
    const first = locatedFrames(stack).next();
    if (!first.done) {
      byFile.set(first.value.file, chunkId);
    }
  }
  cached = { chunkIds, count, byFile };
  return byFile;
};

export const parseStackFrames = (
  stack: string | undefined,
  chunkIds: ChunkIds | undefined = (globalThis as { _posthogChunkIds?: ChunkIds })._posthogChunkIds,
): ClientErrorFrame[] => {
  if (stack === undefined) {
    return [];
  }
  const byFile = chunkIdsByFile(chunkIds);
  const frames: ClientErrorFrame[] = [];
  for (const { fn, file, line, column } of locatedFrames(stack)) {
    const chunkId = byFile.get(file);
    frames.push({
      function: fn
        .replace(/^async /, "")
        .replace(/[^\w$.<>[\] -]/g, "")
        .slice(0, 128),
      file,
      line,
      column,
      ...(chunkId === undefined ? {} : { chunkId }),
    });
    if (frames.length === MAX_ERROR_FRAMES) {
      break;
    }
  }
  return frames;
};
