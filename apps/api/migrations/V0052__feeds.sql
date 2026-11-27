create table feeds (
  feed_url       text        primary key,
  kind           text        not null check (kind in ('podcast', 'youTubeChannel', 'blog')),
  title          text,
  site_url       text,
  image_url      text,
  entries        jsonb       not null default '[]'::jsonb,
  etag           text,
  last_modified  text,
  fetched_at     timestamptz not null,
  checked_at     timestamptz not null,
  failures       integer     not null default 0,
  failing_since  timestamptz,
  next_try_at    timestamptz,
  gone           boolean     not null default false
);

create index feeds_checked_at on feeds (checked_at);
