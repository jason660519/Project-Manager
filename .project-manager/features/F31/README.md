# F31 - xmux Native Browser URL Chrome Stability

Status: In progress  
Feature owner: Codex  
Created: 2026-05-26 AEST  
Located section: `/xmux`

## Summary

F31 fixes the xmux desktop browser pane defect where the URL input disappears when a user edits a browser tab that defaults to the project GitHub URL. The failure is specific to the Tauri native webview path: the OS child webview can draw above React DOM and cover the URL chrome, making the input unusable even though React state still exists.

## Scope

- Keep the URL chrome visible above the embedded browser content.
- Support the full browser tab lifecycle: add, edit, submit, switch, close tab, close pane, retry native embed.
- Preserve the current default behavior: new browser tabs open the workspace homepage, which is the project GitHub URL when configured.
- Add regression tests for the user-visible browser workflows and the native-webview geometry contract.

## Artifacts

- [Feature Spec](./feature-spec.md)
- [TDD Spec](./tdd-spec.md)
- [Debug Retro](./debug-retro.md)
- [Test Scenarios](./test-scenarios.md)
- [Dev Log](./dev-log.md)
