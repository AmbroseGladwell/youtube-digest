create table overview_reservations (
  account_id   uuid        not null references accounts (id) on delete cascade,
  overview_id  uuid        not null,
  source       text        not null check (source in ('ours', 'own', 'share')),
  made         boolean     not null default false,
  held_month   date        check (extract(day from held_month) = 1),
  reserved_at  timestamptz not null,
  primary key (account_id, overview_id)
);
