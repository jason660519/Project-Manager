# F38 TDD Specification

## Suite A: Client-side validation (unit)

| Case | Input | Expected |
| --- | --- | --- |
| A1 | Submit with empty key | "API Key is required" message; no fetch call |
| A2 | Key fails provider's `validatePattern` | "Invalid key format for {label}"; no fetch call |
| A3 | Key passes pattern | fetch is called with correct `apiKind`, `apiKey`, optional `baseUrl` |

## Suite B: API response handling (unit / integration)

| Case | Server response | Expected UI |
| --- | --- | --- |
| B1 | `{ ok: true, models: ["m1","m2"] }` | Green success badge: "Valid — 2 models available" |
| B2 | `{ ok: false, errorReason: "Invalid API Key" }` | Error state showing the errorReason string |
| B3 | AbortError (timeout after 15 s) | "Request timed out. Please try again." |
| B4 | Network TypeError | "Network error: {message}" |

## Suite C: Interaction and state (unit)

| Case | User action | Expected |
| --- | --- | --- |
| C1 | Switch provider | Key input clears; previous result clears |
| C2 | Click Clear | Key and result both reset to initial state |
| C3 | Validate while loading | Button disabled; no second fetch |

## Suite D: Regression guards

| Case | Risk | Expected |
| --- | --- | --- |
| D1 | Provider table still renders | No props changed on `KeysProviderTable` |
| D2 | Detail sheet still opens | `KeysProviderDetailSheet` unchanged |
| D3 | Import modal still works | `EnvImportModal` unchanged |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F38-M01 | Valid Anthropic key | Paste real key → Validate | Green badge + model count |
| F38-M02 | Invalid key | Paste wrong key → Validate | Error reason from API |
| F38-M03 | Empty submit | Leave key empty → Validate | "API Key is required" inline |
| F38-M04 | Wrong format | Paste `abc123` for Anthropic → Validate | Format error inline |

## Required Verification

- `npm run typecheck` — TypeScript must be clean.
- `npm run docs:check` — bilingual governance pass.
- Focused unit tests: `npm test -- --testPathPattern api-key-validation-panel`.
