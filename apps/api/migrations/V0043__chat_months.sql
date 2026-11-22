alter table chat_usage add column library_units bigint not null default 0 check (library_units >= 0);

create view cost_reports.chat_months as
select date_trunc('month', u.day)::date            as month,
       md5('cost-report:' || u.account_id::text)  as account,
       a.plan                                      as plan,
       sum(u.messages)::bigint                     as questions,
       sum(u.units)::bigint                        as units,
       sum(u.library_units)::bigint                as library_units,
       sum(u.units)::float8 / case a.plan when 'free' then 140000 when 'byo-plus' then 700000 else 1400000 end as share
from chat_usage u
join accounts a on a.id = u.account_id
group by 1, 2, 3;

grant select on cost_reports.chat_months to cost_reader;
