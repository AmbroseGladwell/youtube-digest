alter table magic_links
  add column code_hash text check (code_hash is null or length(code_hash) = 64);
