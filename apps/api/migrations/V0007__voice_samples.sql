create table voice_samples (
  key           text        primary key references audio_renders (key) on delete cascade,
  voice         text        not null,
  seeded_at     timestamptz not null,
  superseded_at timestamptz
);
