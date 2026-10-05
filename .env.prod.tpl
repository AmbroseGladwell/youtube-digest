# Rendered by `task deploy:secrets` and piped into `fly secrets import`; never written to a file
# (docs/architecture/deploy.md). Only secrets belong here: everything else is fly.toml's [env].
# Each placeholder is a secret in Bitwarden Secrets Manager, project overview-prod, keyed as the variable.
DATABASE_URL=${DATABASE_URL}
BREVO_API_KEY=${BREVO_API_KEY}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
# The PostHog project's token: write-only, but kept here with the rest (docs/architecture/analytics.md).
POSTHOG_API_KEY=${POSTHOG_API_KEY}
# The residential proxy our server fetches transcripts through, {session} left in for the code
# to fill (docs/architecture/server-side-transcripts.md).
TRANSCRIPT_PROXY_URL=${TRANSCRIPT_PROXY_URL}
