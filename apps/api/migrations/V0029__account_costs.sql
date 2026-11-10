create table account_costs (
  day         date             not null,
  account_id  uuid             not null references accounts (id) on delete cascade,
  area        text             not null check (area in ('generation', 'embeddings', 'transcripts')),
  detail      text             not null check (length(detail) > 0),
  calls       integer          not null default 0 check (calls >= 0),
  quantity    double precision not null default 0 check (quantity >= 0),
  dollars     double precision not null default 0 check (dollars >= 0),
  primary key (day, account_id, area, detail)
);

create index account_costs_account_id_idx on account_costs (account_id);

create table signed_out_costs (
  day       date             not null,
  area      text             not null check (area in ('generation', 'embeddings', 'transcripts')),
  detail    text             not null check (length(detail) > 0),
  calls     integer          not null default 0 check (calls >= 0),
  quantity  double precision not null default 0 check (quantity >= 0),
  dollars   double precision not null default 0 check (dollars >= 0),
  primary key (day, area, detail)
);
