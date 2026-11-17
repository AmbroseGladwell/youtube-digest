-- The episodes a month's transcribing went on, counted once each is transcribed, for Settings › Plan
-- (OV-305, design 305m).
alter table transcription_usage add column episodes integer not null default 0 check (episodes >= 0);
