create table our_key_usage (
  day          date    primary key,
  generations  integer not null default 0 check (generations >= 0)
);
