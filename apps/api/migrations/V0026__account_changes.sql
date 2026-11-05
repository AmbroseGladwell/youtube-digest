alter table sessions
  add column verified_at timestamptz;

create table session_verifications (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions (id) on delete cascade,
  code_hash    text not null unique check (length(code_hash) = 64),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);

create index session_verifications_session_id_created_at_idx on session_verifications (session_id, created_at desc);

create table email_changes (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts (id) on delete cascade,
  old_email          text not null check (old_email = lower(btrim(old_email))),
  new_email          text not null check (new_email = lower(btrim(new_email))),
  code_hash          text unique check (code_hash is null or length(code_hash) = 64),
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  consumed_at        timestamptz,
  revert_token_hash  text unique check (revert_token_hash is null or length(revert_token_hash) = 64),
  revert_expires_at  timestamptz,
  reverted_at        timestamptz
);

create index email_changes_account_id_created_at_idx on email_changes (account_id, created_at desc);
