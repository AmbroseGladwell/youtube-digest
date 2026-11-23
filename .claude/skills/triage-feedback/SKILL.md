---
name: triage-feedback
description: Triage readers' feedback (OV-185) against the Trello board — list untriaged entries from production, propose an outcome for each, act on the board once agreed, and mark each entry. Use when asked to triage, review or go through feedback.
---

# Triage feedback

`docs/features/feedback.md` explains the table, and why it is built this way.

## 1. List what is waiting

Use the Neon connector (`run_sql`) on the project named **The Overview App**, found with
`list_projects`, and its default branch:

```sql
select id, created_at, surface, client_version, kind, overview_id, trail, text
from feedback where triaged_at is null order by created_at limit 50;
```

## 2. Propose, don't act

Search the board (The Overview Backlog) for cards the entry speaks to. For each entry,
propose one outcome to the owner:

- **supports**: an existing card already covers it. Comment there.
- **adds**: an existing card, with something new for it. Edit that card.
- **new-card**: create a card in Backlog from the Card template, give it its `OV-n`, and place it by priority.
- **not-for-us**: say why.

The owner decides. Show proposals as a short table: the entry's id, a gist of what was
said, the outcome, and the card.

## 3. Act, then mark

Only after the board change is made:

```sql
update feedback set triaged_at = now(), triage_outcome = '<outcome>', triage_note = '<e.g. → OV-307>'
where id = '<id>' and triaged_at is null;
```

Check it reads back as triaged before reporting it done.

## Rules

- Never paste a reader's words into Trello, a PR, a commit or a doc. Describe the request in general terms.
- An overview id can be read with The Overview's tools only when it is the owner's own; otherwise leave it.
- Never change or delete a feedback row beyond the three triage fields.
