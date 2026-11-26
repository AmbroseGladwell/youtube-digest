alter table account_costs drop constraint account_costs_area_check;
alter table account_costs add constraint account_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat', 'questions', 'speech'));
alter table signed_out_costs drop constraint signed_out_costs_area_check;
alter table signed_out_costs add constraint signed_out_costs_area_check check (area in ('generation', 'embeddings', 'transcripts', 'chat', 'questions', 'speech'));
