create table narration_render_usage (
  day         date    not null,
  account_id  uuid    not null references accounts (id) on delete cascade,
  renders     integer not null default 0 check (renders >= 0),
  primary key (day, account_id)
);
