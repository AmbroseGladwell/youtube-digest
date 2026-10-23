alter table accounts drop constraint accounts_plan_check;
alter table accounts
  add constraint accounts_plan_check check (plan in ('free', 'byo-plus', 'plus'));

create table overview_usage (
  month       date    not null check (extract(day from month) = 1),
  account_id  uuid    not null references accounts (id) on delete cascade,
  key_source  text    not null check (key_source in ('ours', 'own')),
  overviews   integer not null default 0 check (overviews >= 0),
  primary key (month, account_id, key_source)
);

create index overview_usage_account_id_idx on overview_usage (account_id);
