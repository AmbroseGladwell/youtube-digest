create extension if not exists vector;

create table overview_embeddings (
  account_id     uuid        not null references accounts (id) on delete cascade,
  overview_id    text        not null,
  embedded_rev   integer,
  model          text,
  tokens         integer     not null default 0 check (tokens >= 0),
  attempted_rev  integer     not null,
  attempts       integer     not null default 0 check (attempts >= 0),
  not_before     timestamptz,
  last_error     text,
  updated_at     timestamptz not null,
  primary key (account_id, overview_id)
);

create table claim_embeddings (
  account_id   uuid         not null,
  overview_id  text         not null,
  position     integer      not null check (position >= 0),
  text_hash    text         not null,
  model        text         not null,
  embedding    vector(1536) not null,
  primary key (account_id, overview_id, position),
  foreign key (account_id, overview_id) references overview_embeddings (account_id, overview_id) on delete cascade
);
