create table account_deletions (
  id                        uuid        primary key default gen_random_uuid(),
  account_id                uuid        not null,
  anonymous_id              uuid,
  narration_keys            jsonb       not null default '[]'::jsonb,
  narration_status          text        not null check (narration_status in ('pending', 'done', 'skipped', 'not_configured', 'failed')),
  posthog_account_status    text        not null check (posthog_account_status in ('pending', 'queued', 'skipped', 'not_configured', 'failed')),
  posthog_anonymous_status  text        not null check (posthog_anonymous_status in ('pending', 'queued', 'skipped', 'not_configured', 'failed')),
  last_error                text,
  deleted_at                timestamptz not null,
  finished_at               timestamptz
);

create index account_deletions_unfinished on account_deletions (deleted_at) where finished_at is null;
