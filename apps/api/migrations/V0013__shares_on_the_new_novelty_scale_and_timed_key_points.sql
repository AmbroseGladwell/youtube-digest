update shares
set snapshot = jsonb_set(
  snapshot,
  '{note,keyPoints}',
  (select coalesce(jsonb_agg(jsonb_build_object('text', point, 'range', null) order by position), '[]'::jsonb)
   from jsonb_array_elements(snapshot -> 'note' -> 'keyPoints') with ordinality as points (point, position))
)
where jsonb_typeof(snapshot -> 'note' -> 'keyPoints') = 'array';

update shares
set snapshot = jsonb_set(
  jsonb_set(snapshot, '{note,verdict,novelty}', '"common_knowledge"'),
  '{note,verdict,standsOut}', 'null'
)
where jsonb_typeof(snapshot -> 'note' -> 'verdict') = 'object';
