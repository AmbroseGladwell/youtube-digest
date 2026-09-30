import type { StoredTranscript } from "@overview/domain";

// The url a reader pasted can carry a share tracker or a playlist, which says something about
// them rather than the video, so the shared copy keeps only the video's own address.
export const shareableTranscript = (transcript: StoredTranscript): StoredTranscript =>
  transcript.video === undefined
    ? transcript
    : {
        ...transcript,
        video: { ...transcript.video, url: `https://www.youtube.com/watch?v=${encodeURIComponent(transcript.videoId)}` },
      };
