create table chat_usage (
  day         date    not null,
  account_id  uuid    not null references accounts (id) on delete cascade,
  messages    integer not null default 0 check (messages >= 0),
  primary key (account_id, day)
);

alter table our_key_usage add column chat_messages integer not null default 0 check (chat_messages >= 0);

alter table account_costs drop constraint account_costs_area_check;
alter table account_costs add constraint account_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat'));
alter table signed_out_costs drop constraint signed_out_costs_area_check;
alter table signed_out_costs add constraint signed_out_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat'));
