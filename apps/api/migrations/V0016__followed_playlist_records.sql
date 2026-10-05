alter table records drop constraint records_kind_check;

alter table records add constraint records_kind_check
  check (kind in ('overview', 'overviewState', 'topic', 'settings', 'followedPlaylist'));
