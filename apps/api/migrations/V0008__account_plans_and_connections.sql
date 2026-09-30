alter table accounts
  add column plan text not null default 'free' check (plan in ('free', 'plus'));

create table oauth_clients (
  id                          text        primary key,
  client_name                 text        check (client_name is null or length(client_name) between 1 and 100),
  redirect_uris               text[]      not null check (cardinality(redirect_uris) between 1 and 10),
  token_endpoint_auth_method  text        not null check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  client_secret_hash          text        check (client_secret_hash is null or length(client_secret_hash) = 64),
  created_at                  timestamptz not null,
  check ((token_endpoint_auth_method = 'none') = (client_secret_hash is null))
);

create table connections (
  id            uuid        primary key default gen_random_uuid(),
  account_id    uuid        not null references accounts (id) on delete cascade,
  client_id     text        not null references oauth_clients (id) on delete cascade,
  scope         text        not null,
  created_at    timestamptz not null,
  last_used_at  timestamptz not null
);

create index connections_account_id_idx on connections (account_id);

create table oauth_authorizations (
  id                     uuid        primary key default gen_random_uuid(),
  client_id              text        not null references oauth_clients (id) on delete cascade,
  redirect_uri           text        not null,
  state                  text,
  code_challenge         text        not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  scope                  text        not null,
  resource               text,
  created_at             timestamptz not null,
  expires_at             timestamptz not null,
  account_id             uuid        references accounts (id) on delete cascade,
  decided_at             timestamptz,
  approved               boolean,
  code_hash              text        unique check (code_hash is null or length(code_hash) = 64),
  code_expires_at        timestamptz,
  code_consumed_at       timestamptz,
  connection_id          uuid        references connections (id) on delete set null,
  check ((decided_at is null) = (approved is null)),
  check ((code_hash is null) = (code_expires_at is null)),
  check (code_hash is null or (approved and account_id is not null))
);

create table connection_tokens (
  token_hash     text        primary key check (length(token_hash) = 64),
  connection_id  uuid        not null references connections (id) on delete cascade,
  kind           text        not null check (kind in ('access', 'refresh')),
  created_at     timestamptz not null,
  expires_at     timestamptz not null,
  consumed_at    timestamptz,
  check (kind = 'refresh' or consumed_at is null)
);

create index connection_tokens_connection_id_idx on connection_tokens (connection_id);
