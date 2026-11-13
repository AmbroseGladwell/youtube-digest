-- Where an episode's words can be had, shared between readers: a fact about the episode, never
-- the words themselves, which each reader fetches from the source for themselves
-- (docs/features/podcast-transcripts.md, "Each reader's own copy"; OV-297).
create table podcast_transcript_sources (
  episode_key  text        primary key,
  via          text        not null check (via in ('tag', 'youtube')),
  url          text,
  type         text,
  video_id     text,
  found_at     timestamptz not null,
  check (
    (via = 'tag' and url is not null and type is not null and video_id is null)
    or (via = 'youtube' and video_id is not null and url is null and type is null)
  )
);

-- An episode's words were kept for everyone before; they go, with whatever pointed at them.
delete from transcript_contributions where video_id like 'podcast:%';
delete from shared_transcripts where video_id like 'podcast:%';
