# F55 Test Scenarios

## Normal

- Initialize a new project with one software desktop sheet and confirm the
  dashboard title is `Desktop App Development Progress`.
- Initialize a new project with hardware R&D and QA validation sheets and
  confirm both sheet config files are created under `progress-sheets/`.
- Open Project Progress and switch between discipline sheets without route
  reload errors.
- Create a custom template with text, date, select, tag, person, and percent
  columns, save it, and use it during initialization.
- Duplicate a system template into a custom template, edit a column label, and
  confirm the original system template remains unchanged.
- Connect in local-files backend mode and confirm no sign-in or Docker runtime
  is required.
- Run local Docker Supabase doctor in dry-run mode and confirm it reports
  missing or healthy services without mutating the host.

## Boundary

- Initialize with zero selected sheets and confirm the user sees a clear
  validation message.
- Attempt to create two sheets with the same sheet id and confirm the manifest
  rejects the duplicate.
- Attempt to create a column with an unsupported type and confirm validation
  fails before writing the config.
- Load a project with a missing sheet config path and confirm the dashboard
  shows a visible recoverable error.
- Switch a template where no old fields map to the new template and confirm all
  old values remain archived.
- Rename a sheet title and confirm preferences remain scoped by sheet id, not
  title.

## Error

- Corrupt sheet config JSON reports the file path and parse failure without
  blanking the whole project.
- Tauri initialize cannot create a progress sheet directory and returns a
  visible error with the blocked path.
- Supabase local Docker profile has an invalid URL and the connector reports a
  profile validation error.
- Docker is not installed and install/doctor returns guided setup state rather
  than attempting privileged installation.
- Auth/REST/Storage/Realtime service is absent and doctor reports `failed` or
  `degraded`, never false `healthy`.

## Permission / Safety

- Renderer cannot read service-role key, JWT secret, or database password.
- Local Docker generated secrets are ignored and redacted from logs.
- Self-hosted and cloud profiles use the same renderer-safe connector shape.
- Template switching cannot delete row values without explicit user approval
  and backup.
- Existing schema v10 software feature data is preserved during migration.
- Project initialization through both `ProjectsView` AI scan and `MainClient`
  scaffold paths applies the same selected sheet templates.

