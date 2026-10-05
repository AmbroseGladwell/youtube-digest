create table service_transcript_usage (
  day          date    not null,
  caller       text    not null check (length(caller) > 0),
  fetches      integer not null default 0,
  proxied      integer not null default 0,
  proxy_bytes  bigint  not null default 0,
  primary key (day, caller)
);
