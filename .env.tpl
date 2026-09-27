# Rendered to .env by `task secrets`; edit this template, never .env (docs/conventions/secrets.md).
# ${NAME} is a secret in Bitwarden Secrets Manager, project overview-dev, keyed NAME.
# Per-machine values that are not secrets go in .env.local, which is read after .env.

# apps/api
DATABASE_URL=postgres://overview@localhost:5433/overview
PORT=3000
MIN_SUPPORTED_CLIENT_VERSION=1
SESSION_TTL_DAYS=30
# The extension panel's origin, chrome-extension://<id> from chrome://extensions. Differs per checkout, so set it in .env.local.
CORS_ALLOWED_ORIGINS=
# Where the web app is served from: every magic link opens /sign-in there (docs/features/sign-in.md).
APP_URL=http://localhost:5173
# log prints each magic link to the API's output; brevo sends it and needs the two below and an https APP_URL.
MAIL_TRANSPORT=log
BREVO_API_KEY=${BREVO_API_KEY}
MAIL_FROM=The Overview <hello@theoverviewapp.com>
