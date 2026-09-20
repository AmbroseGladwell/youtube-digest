// The same fact in the two lengths the app has room for: the long one where it is the
// whole point of the panel, the short one where it is a caveat in front of a link to
// Settings. Together here rather than apart in four components, so the two can be read
// against each other and cannot drift into three.
//
// "never through our servers" is true of generation and of every rung built so far. It
// stops being true of the whole app the day the shared transcript cache lands, and this
// is the sentence that will need a clause then (docs/features/transcript-retrieval.md).
export const BYO_KEY_NOTE =
  "Bring-your-own-key. Your Anthropic key stays on this device and goes straight to " +
  "Anthropic, never through our servers. A Supadata key is optional, and only used for " +
  "transcripts when nothing here can fetch them.";

export const BYO_KEY_NOTE_SHORT =
  "Generation is bring-your-own-key, and your key stays on this device.";
