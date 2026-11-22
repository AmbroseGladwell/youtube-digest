alter table chat_usage add column units bigint not null default 0 check (units >= 0);

alter table our_key_usage add column chat_units bigint not null default 0 check (chat_units >= 0);
