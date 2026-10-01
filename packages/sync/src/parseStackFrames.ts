import { MAX_ERROR_FRAMES, type ClientErrorFrame } from "@overview/domain";

const V8_FRAME = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/;
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)$/;

const bundlePath = (location: string): string | null => {
  try {
    return new URL(location).pathname.replace(/^\/+/, "").replace(/[^\w./@~+-]/g, "_").slice(0, 200);
  } catch {
    return null;
  }
};

// A stack cut to function names and paths inside the bundle: a frame's address loses its
// origin, query and hash, and a frame with no address at all is dropped
// (docs/architecture/errors-and-logs.md, "What an error may carry").
export function parseStackFrames(stack: string | undefined): ClientErrorFrame[] {
  if (stack === undefined) return [];
  const frames: ClientErrorFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = V8_FRAME.exec(line) ?? GECKO_FRAME.exec(line);
    if (match === null) continue;
    const [, fn = "", location = "", lineNumber = "0", column = "0"] = match;
    const file = bundlePath(location);
    if (file === null) continue;
    frames.push({
      function: fn.replace(/^async /, "").replace(/[^\w$.<>[\] -]/g, "").slice(0, 128),
      file,
      line: Number(lineNumber),
      column: Number(column),
    });
    if (frames.length === MAX_ERROR_FRAMES) break;
  }
  return frames;
}
