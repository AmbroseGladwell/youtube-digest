alter table trial_tokens
  add column reads integer not null default 0 check (reads >= 0);

alter table trial_address_usage
  add column reads integer not null default 0 check (reads >= 0);
