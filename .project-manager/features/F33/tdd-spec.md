# F33 TDD Specification

## Suite A: Discovery plan validation (`discovery.plan.test.ts`)

1. `passive-lan` preset is valid without nmap.
2. Active LAN without CIDRs and nmap probe returns validation error.
3. nmap probe on LAN passive scope returns validation error (guardrail if UI bypassed).
4. Host scope requires non-empty address when nmap is selected.
5. Empty probe list returns validation error.

## Suite B: Probe registry (`discovery.registry.test.ts`)

1. Each built-in probe declares allowed scope kinds.
2. Passive LAN: arp, bonjour, docker-local — **not** nmap.
3. Active LAN: includes nmap.
4. Host scope: includes nmap.

## Suite E: Plan mutations / user scenarios (`discovery.plan-mutations.test.ts`)

| Case | Steps (logical) | Expected |
|------|-----------------|----------|
| E1 | Passive LAN preset + enable nmap | Scope → active LAN; probes include nmap |
| E2 | E1 without CIDR | `validateDiscoveryPlan` → false |
| E3 | E1 + CIDR `192.168.1.0/24` | `validateDiscoveryPlan` → true |
| E4 | Active intranet + passive mode | nmap removed from probes |
| E5 | `probesForScope` passive LAN | nmap not in list (checkbox disabled in UI) |

## Suite C: Connected instance mapping (`integrations.connectedInstances.test.ts`)

1. Scanned ARP row: `installMethod: 'arp'`, `status: 'live'`.
2. Seeded row: `installMethod: 'manual'`, `status: 'live'`.
3. Stopped Docker: `status: 'disconnected'`.

## Manual (Tauri) — required before marking F33 done

| ID | User scenario | Steps | Expected |
|----|---------------|-------|----------|
| F33-M01 | Passive only | Preset Passive LAN → Run | Rows update; no nmap; Run enabled |
| F33-M02 | nmap dead-end fix | Passive LAN → check nmap | UI switches to Active; CIDR field visible; hint shown |
| F33-M03 | Full intranet | Active + CIDR + nmap + Run | Scan completes; devices may include nmap source |
| F33-M04 | nmap missing | Uncheck install; run nmap plan | Warning in banner; or auto brew install on macOS |
| F33-M05 | Test reachability | Test Selected on HTTP row | Live / Disconnected updates |

## Regression guard

- Do not allow `probesForScope(lan passive)` to include nmap (prevents checkbox without mode switch).
