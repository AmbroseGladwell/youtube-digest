create table magic_links (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(btrim(email))),
  surface      text not null check (surface in ('web', 'extension')),
  token_hash   text not null unique check (length(token_hash) = 64),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);

create index magic_links_email_created_at_idx on magic_links (email, created_at desc);

create table link_codes (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts (id) on delete cascade,
  code_hash    text not null unique check (length(code_hash) = 64),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);
