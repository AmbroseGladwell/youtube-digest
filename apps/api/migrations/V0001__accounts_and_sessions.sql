create table accounts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(btrim(email))),
  created_at  timestamptz not null default now(),
  last_seq    bigint not null default 0
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  token_hash    text not null unique check (length(token_hash) = 64),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now()
);

create index sessions_account_id_idx on sessions (account_id);
