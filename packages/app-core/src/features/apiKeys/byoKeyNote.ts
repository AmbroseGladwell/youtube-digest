// The same fact in the two lengths the app has room for: the long one where it is the
// whole point of the panel, the short one where it is a caveat in front of a link to
// Settings. Together here rather than apart in four components, so the two can be read
// against each other and cannot drift into three.
//
// It names no provider now that there are six (design 110a). Keys never reach our servers;
// the video being summarised does, once, when the shared transcript cache is asked for it
// (docs/features/shared-transcript-cache.md).
export const BYO_KEY_NOTE =
  "Bring your own key. Your key stays on this device and goes straight to the provider, " +
  "never through our servers. Transcripts are looked up in our shared cache first, by " +
  "video, and fetched by our server when nothing else can.";

// Design 110a and 110m end the section with this rather than opening with it, so the list
// and the choice land above the fold in the 600-tall panel.
export const BYO_KEY_NOTE_SHORT =
  "Bring your own key. Your key stays on this device and goes straight to the provider, " +
  "never through our servers.";
