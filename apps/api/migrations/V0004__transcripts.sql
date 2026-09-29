create table transcripts (
  account_id  uuid        not null references accounts (id) on delete cascade,
  video_id    text        not null check (length(video_id) > 0),
  stored_at   timestamptz not null,
  body        jsonb       not null,
  primary key (account_id, video_id),
  check (body ->> 'videoId' = video_id)
);
