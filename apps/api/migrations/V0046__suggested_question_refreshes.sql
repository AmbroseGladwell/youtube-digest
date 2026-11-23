-- OV-350 slice 2: docs/features/suggested-questions.md, "Slice 2: the refresh".
create table question_refreshes (
  id                 uuid        primary key default gen_random_uuid(),
  account_id         uuid        not null references accounts (id) on delete cascade,
  started_at         timestamptz not null,
  finished_at        timestamptz,
  scopes             text[]      not null default '{}',
  pairs_labelled     integer     not null default 0 check (pairs_labelled >= 0),
  questions_written  integer     not null default 0 check (questions_written >= 0),
  outcome            text        not null default 'running' check (outcome in ('running', 'written', 'full', 'no-pairs', 'failed'))
);

create index question_refreshes_by_account on question_refreshes (account_id, started_at desc);

create table question_scopes_opened (
  account_id  uuid        not null references accounts (id) on delete cascade,
  scope_key   text        not null,
  opened_at   timestamptz not null,
  primary key (account_id, scope_key)
);

alter table account_costs drop constraint account_costs_area_check;
alter table account_costs add constraint account_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat', 'questions'));
alter table signed_out_costs drop constraint signed_out_costs_area_check;
alter table signed_out_costs add constraint signed_out_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat', 'questions'));
