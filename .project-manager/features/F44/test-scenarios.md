# F44 Test Scenarios

## Scenario Matrix

| ID | User path | Risk | Automated | Status |
| --- | --- | --- | --- | --- |
| F44-S01 | Development sheet F44 artifacts | Resume | Config paths | Kickoff |
| F44-S02 | npm blocked → Run i18n gate | False “not installed” | A4, D2 | Target |
| F44-S03 | permission blocked → Run | Silent fail | A2 | Target |
| F44-S04 | terminal blacklist → Run | Wrong layer message | A6 | Target |
| F44-S05 | All layers OK → pass | Bypass regression | B1, B3 | Target |
| F44-S06 | Read execution-policy doc | Drift | docs | Target |

## F44-S02: Operator enables npm in Commands (user-reported path)

1. User opens Company Standards, clicks **Run** on i18n gate without exposing npm.
2. UI shows: System CLI policy — enable **npm** in Integrations Hub → Commands (or Settings AI CLI Preset).
3. User opens Commands, enables npm.
4. User grants `tool:run_command` on Permissions if still blocked.
5. User clicks **Run** again → process starts, Logs show output.

**Expected:** No bypass; message does not say “install npm”.

## F44-S05: Regression — no bypass

1. Code search / test asserts `spawnAgent` never receives `skipSystemCliInventoryCheck`.
2. `assertCommandPolicyAllows` runs for `npm` when in inventory.
