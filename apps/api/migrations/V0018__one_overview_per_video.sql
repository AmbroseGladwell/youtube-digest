drop index records_live_overview_by_video;

create unique index records_one_live_overview_per_video
  on records (account_id, video_id)
  where kind = 'overview' and not deleted and video_id is not null;
