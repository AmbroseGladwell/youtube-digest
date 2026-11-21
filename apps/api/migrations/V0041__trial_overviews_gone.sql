drop table trial_overviews;

alter table trial_tokens drop column overviews;

alter table trial_address_usage drop column overviews;

alter table our_key_usage drop column signed_out;
