alter table records add column source_key text
  generated always as (
    case when kind = 'overview' then
      coalesce(
        case body -> 'source' ->> 'kind'
          when 'youtube' then body -> 'source' ->> 'id'
          else (body -> 'source' ->> 'kind') || ':' || (body -> 'source' ->> 'id')
        end,
        body -> 'video' ->> 'id'
      )
    end
  ) stored;

create unique index records_one_live_overview_per_source
  on records (account_id, source_key)
  where kind = 'overview' and not deleted and source_key is not null;
