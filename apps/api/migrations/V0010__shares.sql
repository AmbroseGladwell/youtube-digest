create table shares (
  token         text        primary key check (token ~ '^[A-Za-z0-9_-]{16}$'),
  account_id    uuid        not null references accounts (id) on delete cascade,
  overview_id   uuid        not null,
  snapshot      jsonb       not null,
  content_hash  text        not null,
  shared_at     timestamptz not null,
  updated_at    timestamptz not null,
  revoked_at    timestamptz,
  views         bigint      not null default 0 check (views >= 0)
);

create index shares_account on shares (account_id, shared_at desc);

create unique index shares_live_overview on shares (account_id, overview_id) where revoked_at is null;
