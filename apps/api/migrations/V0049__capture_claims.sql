create table capture_claims (
  account_id  uuid        not null references accounts (id) on delete cascade,
  source_key  text        not null,
  holder      text        not null,
  until       timestamptz not null,
  primary key (account_id, source_key)
);
