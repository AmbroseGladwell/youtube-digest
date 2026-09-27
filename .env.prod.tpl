# Rendered by `task deploy:secrets` and piped into `fly secrets import`; never written to a file
# (docs/architecture/deploy.md). Only secrets belong here: everything else is fly.toml's [env].
# Each placeholder is a secret in Bitwarden Secrets Manager, project overview-prod, keyed as the variable.
DATABASE_URL=${DATABASE_URL}
BREVO_API_KEY=${BREVO_API_KEY}
