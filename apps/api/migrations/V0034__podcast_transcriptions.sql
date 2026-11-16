-- An episode transcribed from its own audio for the one caller who asked, an account or a trial's
-- address: never shared, and held only until that caller collects the words. The audio is never
-- kept (docs/features/speech-to-text.md, "The server rung"; OV-305).
create table podcast_transcriptions (
  id                uuid        primary key,
  caller            text        not null,
  account_id        uuid        references accounts (id) on delete cascade,
  source_key        text        not null,
  audio_url         text        not null,
  max_seconds       integer     not null check (max_seconds > 0),
  reserved_seconds  integer     not null check (reserved_seconds >= 0),
  status            text        not null check (status in ('queued', 'waiting', 'transcribing', 'ready', 'failed')),
  host_call_id      text,
  requested_at      timestamptz not null,
  claimed_until     timestamptz,
  started_at        timestamptz,
  finished_at       timestamptz,
  transcript        jsonb,
  failure           text,
  check ((caller like 'account:%') = (account_id is not null)),
  check ((status = 'ready') = (transcript is not null)),
  unique (caller, source_key)
);

create index podcast_transcriptions_open on podcast_transcriptions (requested_at)
  where status in ('queued', 'waiting', 'transcribing');

-- Seconds of audio transcribed for each caller in a UTC month, held before a job starts and
-- settled to what the audio measured once it finishes.
create table transcription_usage (
  month       date    not null,
  caller      text    not null,
  account_id  uuid    references accounts (id) on delete cascade,
  seconds     integer not null default 0 check (seconds >= 0),
  primary key (month, caller),
  check ((caller like 'account:%') = (account_id is not null))
);
