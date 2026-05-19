# F04 Feature Spec - Add Project by GitHub URL

## Purpose

Allow a user to onboard an existing GitHub repository by pasting a repository URL into the Add Project flow. Project Manager validates the URL, collects enough repository metadata to create a project entry, and leaves the imported project ready for dashboard review.

## Source References

- `docs/product/user-scenarios.md` - Scenario 1.5, Add Project by GitHub URL.
- `docs/architecture/ADR-004-api-call-security.md` - API calls and secrets stay outside the renderer.
- `app/ui/views/ProjectsView.tsx` - Add Project modal and project persistence path.
- `src-tauri/src/lib.rs` - GitHub URL validation and bridge commands.

## Functional Requirements

1. Accept GitHub repository URLs in the form `https://github.com/<owner>/<repo>`.
2. Reject malformed URLs with a visible, actionable validation error.
3. Use the Rust/Tauri side for network or token-backed GitHub operations.
4. Store GitHub credentials in the operating system keychain, not localStorage.
5. Create or update a Project Manager project entry without overwriting existing user-owned project data.
6. Trigger or hand off to the ingestion pipeline after the repository is available locally.

## Dashboard Contract

This is the canonical `paths.spec` file for F04. The feature overview remains `.project-manager/features/F04/README.md`, and `notes` remains short text only.

## Acceptance Checks

- Adding a valid GitHub URL produces one project entry.
- Adding an invalid GitHub URL does not mutate the project list.
- Re-adding an already tracked repository does not duplicate it silently.
- Browser mode does not require secrets to be exposed to the renderer.
- Dashboard links for this feature resolve to files that exist.
