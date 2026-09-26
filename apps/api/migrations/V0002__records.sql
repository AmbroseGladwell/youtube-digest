create table records (
  account_id      uuid        not null references accounts (id) on delete cascade,
  kind            text        not null check (kind in ('overview', 'overviewState', 'topic', 'settings')),
  id              text        not null,
  schema_version  integer     not null check (schema_version >= 1),
  rev             integer     not null check (rev >= 1),
  seq             bigint      not null,
  updated_at      text        check (updated_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  stored_at       timestamptz not null default now(),
  deleted         boolean     not null default false,
  body            jsonb,
  primary key (account_id, kind, id),
  unique (account_id, seq),
  check (deleted = (body is null)),
  check (deleted or updated_at is not null)
);
