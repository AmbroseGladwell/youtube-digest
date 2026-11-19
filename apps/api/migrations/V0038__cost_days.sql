create view cost_reports.cost_days as
select day, area, detail,
       sum(calls)::bigint as calls,
       sum(quantity)      as quantity,
       sum(dollars)       as dollars
from (
  select day, area, detail, calls, quantity, dollars from account_costs
  union all
  select day, area, detail, calls, quantity, dollars from signed_out_costs
) c
group by day, area, detail;

grant select on cost_reports.cost_days to cost_reader;
