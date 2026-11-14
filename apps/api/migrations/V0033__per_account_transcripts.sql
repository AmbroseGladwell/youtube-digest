-- Each account's transcript is its own copy, read only by that account; nothing is kept for every
-- reader and no shared link carries a transcript (docs/features/transcript-storage.md; OV-295,
-- after the terms review of 13 Nov 2026). The reverse of V0009's move into a shared cache.
alter table account_transcripts add column body jsonb;

update account_transcripts a
set body = s.body
from shared_transcripts s
where s.video_id = a.video_id and s.words_hash = a.words_hash;

delete from account_transcripts where body is null;

-- Dropping the column drops the foreign key into shared_transcripts with it.
alter table account_transcripts drop column words_hash;
alter table account_transcripts alter column body set not null;
alter table account_transcripts add check (body ->> 'videoId' = video_id);

drop table transcript_contributions;
drop table shared_transcripts;

update shares set snapshot = jsonb_set(snapshot, '{transcript}', 'null'::jsonb) where snapshot -> 'transcript' <> 'null'::jsonb;
