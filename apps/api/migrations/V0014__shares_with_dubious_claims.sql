update shares
set snapshot = jsonb_set(snapshot, '{note,verdict,dubiousClaims}', 'null')
where jsonb_typeof(snapshot -> 'note' -> 'verdict') = 'object'
  and not (snapshot -> 'note' -> 'verdict') ? 'dubiousClaims';
