// The same fact in the two lengths the app has room for: the long one where it is the
// whole point of the panel, the short one where it is a caveat in front of a link to
// Settings. Together here rather than apart in four components, so the two can be read
// against each other and cannot drift into three.
//
// Keys never reach our servers; the video being summarised does, once, when the shared
// transcript cache is asked for it (docs/features/shared-transcript-cache.md).
export const BYO_KEY_NOTE =
  "Bring-your-own-key. Your Anthropic key stays on this device and goes straight to " +
  "Anthropic, never through our servers. Transcripts are looked up in our shared cache " +
  "first, by video. A Supadata key is optional, and only used for transcripts when " +
  "nothing else can fetch them.";

export const BYO_KEY_NOTE_SHORT =
  "Generation is bring-your-own-key, and your key stays on this device.";
