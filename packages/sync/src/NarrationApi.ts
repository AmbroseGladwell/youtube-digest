import type { NarrationRender, NarrationVoice, ReadyNarration } from "@overview/domain";

export type NarrationPriority = "interactive" | "background";

// The narration surface (docs/features/tts-pre-rendered-speech.md, "The API side"). `peek`
// asks by key and queues nothing, which is how a note can say whether its audio exists
// before anybody presses play.
export interface NarrationApi {
  peek(lines: readonly string[], voice: NarrationVoice): Promise<NarrationRender | null>;
  request(lines: readonly string[], voice: NarrationVoice, priority: NarrationPriority): Promise<NarrationRender>;
  status(key: string): Promise<NarrationRender>;
  fileUrl(render: ReadyNarration): string;
}
