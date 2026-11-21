-- A search index of each account's own transcripts, a minute a row, as chat cites them: derived
-- from account_transcripts and gone with it, the overview's sweep or the account. The words
-- themselves stay in the transcript; a hit is cut from it again (OV-352; docs/features/chats.md,
-- "Details from other transcripts").
create table transcript_passages (
  account_id  uuid    not null,
  video_id    text    not null,
  passage_id  text    not null,
  start_ms    integer not null,
  end_ms      integer not null,
  terms       tsvector not null,
  primary key (account_id, video_id, passage_id),
  foreign key (video_id, account_id) references account_transcripts (video_id, account_id) on delete cascade
);

create index transcript_passages_terms on transcript_passages using gin (terms);
