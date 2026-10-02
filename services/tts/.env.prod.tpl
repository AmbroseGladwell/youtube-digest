# Rendered by `task deploy:tts:secrets` and piped into `fly secrets import` for the-overview-tts;
# never written to a file (docs/architecture/deploy.md, "The TTS service").
# The PostHog project's token, the same secret the API's template names (docs/architecture/errors-and-logs.md).
POSTHOG_API_KEY=${POSTHOG_API_KEY}
