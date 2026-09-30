create table audio_renders (
  key              text        primary key check (key ~ '^[0-9a-f]{64}$'),
  voice            text        not null,
  render_version   integer     not null,
  lines            jsonb       not null,
  status           text        not null check (status in ('queued', 'rendering', 'ready', 'failed')),
  priority         smallint    not null check (priority in (0, 1)),
  attempts         integer     not null default 0,
  not_before       timestamptz not null,
  requested_at     timestamptz not null,
  requested_by     uuid        references accounts (id) on delete set null,
  started_at       timestamptz,
  finished_at      timestamptz,
  line_starts      jsonb,
  duration_seconds double precision,
  last_error       text,
  check (status <> 'ready' or (line_starts is not null and duration_seconds is not null))
);

create index audio_renders_claimable on audio_renders (priority, requested_at)
  where status in ('queued', 'rendering');

create index audio_renders_outstanding on audio_renders (requested_by)
  where status in ('queued', 'rendering');
