create table shared_transcripts (
  video_id        text        primary key check (length(video_id) > 0),
  body            jsonb       not null,
  contributed_by  uuid        references accounts (id) on delete set null,
  contributed_at  timestamptz not null,
  check (body ->> 'videoId' = video_id)
);

create index shared_transcripts_contributed_by on shared_transcripts (contributed_by);

insert into shared_transcripts (video_id, body, contributed_by, contributed_at)
select distinct on (video_id) video_id, body, account_id, stored_at
from transcripts
where jsonb_array_length(body -> 'segments') > 0
order by video_id, (body ->> 'generated')::boolean, (body ? 'video') desc, stored_at;

delete from transcripts t
where not exists (select 1 from shared_transcripts s where s.video_id = t.video_id);

alter table transcripts drop column body;
alter table transcripts rename to account_transcripts;
alter table account_transcripts
  add foreign key (video_id) references shared_transcripts (video_id) on delete cascade;
