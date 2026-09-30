create table shared_transcripts (
  video_id      text        not null check (length(video_id) > 0),
  words_hash    text        not null,
  body          jsonb       not null,
  stored_at     timestamptz not null,
  confirmed_at  timestamptz,
  primary key (video_id, words_hash),
  check (body ->> 'videoId' = video_id)
);

create table transcript_contributions (
  video_id        text        not null,
  account_id      uuid        not null,
  words_hash      text        not null,
  contributed_at  timestamptz not null,
  primary key (video_id, account_id)
);

create index transcript_contributions_account on transcript_contributions (account_id);
create index transcript_contributions_contributed_at on transcript_contributions (contributed_at);

insert into shared_transcripts (video_id, words_hash, body, stored_at)
select distinct on (video_id, 'legacy:' || md5(body::text))
  video_id, 'legacy:' || md5(body::text), body, stored_at
from transcripts
order by video_id, 'legacy:' || md5(body::text), stored_at;

alter table transcripts add column words_hash text;
update transcripts set words_hash = 'legacy:' || md5(body::text);
alter table transcripts alter column words_hash set not null;
alter table transcripts drop column body;
alter table transcripts rename to account_transcripts;
alter table account_transcripts
  add foreign key (video_id, words_hash) references shared_transcripts (video_id, words_hash) on delete cascade;
