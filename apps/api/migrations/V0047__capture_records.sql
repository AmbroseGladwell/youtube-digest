alter table records drop constraint records_kind_check;

alter table records add constraint records_kind_check
  check (kind in ('overview', 'overviewState', 'topic', 'settings', 'followedPlaylist', 'project', 'projectMember', 'chat', 'suggestedQuestion', 'capture'));

alter table records alter column source_key set expression as (
  case
    when kind = 'overview' then
      coalesce(
        case body -> 'source' ->> 'kind'
          when 'youtube' then body -> 'source' ->> 'id'
          else (body -> 'source' ->> 'kind') || ':' || (body -> 'source' ->> 'id')
        end,
        body -> 'video' ->> 'id'
      )
    when kind = 'capture' then body ->> 'sourceKey'
  end
);

create unique index records_one_live_capture_per_source
  on records (account_id, source_key)
  where kind = 'capture' and not deleted and source_key is not null;

create table capture_saves (
  month       date    not null check (extract(day from month) = 1),
  account_id  uuid    not null references accounts (id) on delete cascade,
  saves       integer not null default 0 check (saves >= 0),
  primary key (month, account_id)
);

create index capture_saves_account_id_idx on capture_saves (account_id);
