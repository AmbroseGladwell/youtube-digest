-- OV-185: docs/features/feedback.md, "What is stored".
create table feedback (
  id              uuid        primary key default gen_random_uuid(),
  account_id      uuid        not null references accounts (id) on delete cascade,
  created_at      timestamptz not null,
  surface         text        not null check (surface in ('web', 'extension')),
  client_version  integer     not null check (client_version > 0),
  overview_id     uuid,
  kind            text        check (kind in ('wrong', 'idea')),
  text            text        not null check (length(text) between 1 and 4000),
  trail           text[]      not null default '{}',
  triaged_at      timestamptz,
  triage_outcome  text        check (triage_outcome in ('supports', 'adds', 'new-card', 'not-for-us')),
  triage_note     text,
  check ((triaged_at is null) = (triage_outcome is null))
);

create index feedback_untriaged on feedback (created_at) where triaged_at is null;
create index feedback_by_account on feedback (account_id);

create view cost_reports.feedback_entries as
select f.created_at::date                          as day,
       md5('cost-report:' || f.account_id::text)  as account,
       a.plan                                      as plan,
       f.surface                                   as surface,
       coalesce(f.kind, 'none')                    as kind,
       f.overview_id is not null                   as from_overview,
       f.triaged_at is not null                    as triaged,
       f.triage_outcome                            as outcome
from feedback f
join accounts a on a.id = f.account_id;

grant select on cost_reports.feedback_entries to cost_reader;
