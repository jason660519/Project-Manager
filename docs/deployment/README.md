# Deployment

Project-Manager follows Company AI App Standards v0.2 for deployment documentation.

## Runtime Model

Project-Manager is a desktop app with local state and optional external service integrations. Keep local data, settings, secrets, and plugin state scoped to this app unless a documented plugin contract shares them.

## Self-Hosted Services

If Project-Manager uses shared home-lab services, document the service here before wiring the app to it:

- Service name.
- Environment variable or local config key.
- Port and protocol.
- Health check.
- Data volume boundary.
- Backup and restore note.

Do not hard-code internal server addresses in source modules. Keep them in local environment files or repo-local deployment notes.
