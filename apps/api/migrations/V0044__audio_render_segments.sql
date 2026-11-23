-- Each streamed segment's length, in order, while a render is first played: docs/features/tts-pre-rendered-speech.md, "Streaming".
alter table audio_renders add column segment_seconds jsonb;

create index audio_renders_segments_kept on audio_renders (finished_at)
  where segment_seconds is not null;
