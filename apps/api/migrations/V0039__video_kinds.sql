create table video_kinds (
  video_id    text        primary key,
  note_kind   text        not null check (note_kind in ('recipe', 'process', 'default')),
  checked_at  timestamptz not null
);

create table video_kind_checks_signed_out (
  day     date    primary key,
  checks  integer not null default 0 check (checks >= 0)
);
