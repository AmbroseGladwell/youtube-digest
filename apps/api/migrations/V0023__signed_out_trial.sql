create table trial_tokens (
  token_hash  text        primary key,
  issued_at   timestamptz not null,
  overviews   integer     not null default 0 check (overviews >= 0)
);

create table trial_address_usage (
  day        date    not null,
  address    text    not null,
  overviews  integer not null default 0 check (overviews >= 0),
  primary key (day, address)
);

create table trial_overviews (
  overview_id  uuid        primary key,
  made_at      timestamptz not null
);

alter table our_key_usage
  add column signed_out integer not null default 0 check (signed_out >= 0);
