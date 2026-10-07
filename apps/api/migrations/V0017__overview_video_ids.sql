alter table records add column video_id text
  generated always as (case when kind = 'overview' then body -> 'video' ->> 'id' end) stored;

create index records_live_overview_by_video
  on records (account_id, video_id)
  where kind = 'overview' and not deleted and video_id is not null;
