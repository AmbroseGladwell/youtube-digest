alter table accounts
  add column first_name text check (first_name is null or length(first_name) between 1 and 80);

alter table magic_links
  add column intent text not null default 'signIn' check (intent in ('signIn', 'createAccount')),
  add column first_name text check (first_name is null or length(first_name) between 1 and 80);
