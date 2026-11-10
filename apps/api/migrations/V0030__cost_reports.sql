create schema cost_reports;

create view cost_reports.cost_lines as
select date_trunc('month', c.day)::date            as month,
       md5('cost-report:' || c.account_id::text)  as account,
       a.plan                                      as plan,
       c.area, c.detail,
       sum(c.calls)::bigint                        as calls,
       sum(c.quantity)                             as quantity,
       sum(c.dollars)                              as dollars
from account_costs c
join accounts a on a.id = c.account_id
group by 1, 2, 3, 4, 5
union all
select date_trunc('month', day)::date, null, 'signed-out', area, detail,
       sum(calls)::bigint, sum(quantity), sum(dollars)
from signed_out_costs
group by 1, 4, 5;

create view cost_reports.account_months as
with months as (
  select date_trunc('month', day)::date as month, account_id from account_costs
  union
  select month, account_id from overview_usage
  union
  select date_trunc('month', day)::date, account_id from narration_render_usage
)
select m.month,
       md5('cost-report:' || m.account_id::text) as account,
       a.plan,
       date_trunc('month', a.created_at)::date    as joined_month,
       coalesce((select sum(overviews) from overview_usage u
                 where u.account_id = m.account_id and u.month = m.month and u.key_source = 'ours'), 0)::bigint as overviews_ours,
       coalesce((select sum(overviews) from overview_usage u
                 where u.account_id = m.account_id and u.month = m.month and u.key_source = 'own'), 0)::bigint  as overviews_own,
       coalesce((select sum(renders) from narration_render_usage r
                 where r.account_id = m.account_id and date_trunc('month', r.day) = m.month), 0)::bigint       as renders,
       coalesce((select sum(dollars) from account_costs c
                 where c.account_id = m.account_id and date_trunc('month', c.day) = m.month), 0)              as metered_dollars,
       coalesce((select sum(quantity) from account_costs c
                 where c.account_id = m.account_id and date_trunc('month', c.day) = m.month
                   and c.area = 'transcripts' and c.detail = 'proxy'), 0)                                     as proxy_bytes,
       exists (select 1 from overview_usage u
               where u.account_id = m.account_id and u.month = m.month and u.overviews > 0)                   as active
from months m
join accounts a on a.id = m.account_id;

create view cost_reports.plan_accounts as
select plan, count(*)::bigint as accounts
from accounts
group by plan;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cost_reader') then
    create role cost_reader nologin;
  end if;
end
$$;

grant usage on schema cost_reports to cost_reader;
grant select on all tables in schema cost_reports to cost_reader;
