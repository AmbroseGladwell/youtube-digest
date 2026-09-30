import type { NarrationRender, NarrationVoice, VoiceSample } from "@overview/domain";

export type NarrationPriority = "interactive" | "background";

// Narration in a voice: the chosen one, or the one an older note was narrated in before the
// reader chose another (docs/features/narration-voice.md, "Old audio").
export interface VoicedNarration {
  voice: NarrationVoice;
  render: NarrationRender;
}

// The narration surface (docs/features/tts-pre-rendered-speech.md, "The API side"). `peek`
// asks by key and queues nothing, which is how a note can say whether its audio exists
// before anybody presses play.
export interface NarrationApi {
  peek(lines: readonly string[], voice: NarrationVoice): Promise<VoicedNarration | null>;
  request(lines: readonly string[], voice: NarrationVoice, priority: NarrationPriority): Promise<NarrationRender>;
  status(key: string): Promise<NarrationRender>;
  discard(key: string): Promise<void>;
  samples(): Promise<VoiceSample[]>;
  fileUrl(playable: { fileUrl: string }): string;
}
