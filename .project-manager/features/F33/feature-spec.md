# F33: Network Discovery Plan

## Purpose

Give operators explicit control over **where** and **how** network inventory is collected in Integrations Hub → Connected Instances, instead of a single opaque Discover action.

## User Stories

### US-01: Compose a discovery run

**As a** power user  
**I want** a Discover menu to pick scope (local / LAN passive / LAN active CIDR / host) and probes (ARP, Bonjour, Docker, nmap)  
**So that** I only run the scans I intend

### US-02: Quick passive LAN

**As a** developer  
**I want** a one-click preset for passive LAN discovery  
**So that** opening the sheet stays fast and low-risk

### US-03: Active intranet scan

**As a** homelab operator  
**I want** to enter `192.168.1.0/24` and enable nmap  
**So that** hosts not yet in my ARP cache appear in the table

### US-04: Scannable inventory columns

**As a** reviewer  
**I want** Scan method and live/disconnected status on network rows  
**So that** I can sort and filter without reading long status labels

### US-05: nmap on Passive LAN does not dead-end (UX fix)

**As a** user on the Passive LAN preset  
**I want** checking **nmap** to switch me to **Active LAN** and show the CIDR field  
**So that** Run discovery is not permanently disabled with a confusing error

**Acceptance:**

- Checking nmap while scope is passive LAN auto-selects Active LAN.
- nmap checkbox is disabled (greyed) on passive LAN until user selects Active.
- Switching back to Passive auto-unchecks nmap.
- With Active + nmap + valid private CIDR, Run discovery is enabled.

### US-06: nmap installation

**As a** macOS user without nmap  
**I want** `npm run discovery:install-nmap` or in-app install  
**So that** active scans work after Homebrew install

## Functional Requirements (P0)

- **Discover ▾** on Connected Instances toolbar opens `DiscoverPlanDialog`.
- Primary button runs **last plan** (localStorage) or built-in preset `passive-lan`.
- `DiscoveryPlan` JSON passed to Rust `run_discovery_plan`.
- Built-in probes: `arp`, `bonjour`, `docker-local`, `nmap`.
- Scopes: `local`, `lan` (passive|active + optional CIDRs), `host` (single address for nmap).
- **Probe compatibility** enforced in UI (`probesForScope`) and validation (`validateDiscoveryPlan`).
- **Plan mutations** (`applyProbeToggle`, `applyLanMode`) keep scope/probes consistent.
- Results merge into existing `ConnectedInstanceScanSnapshot` pipeline.
- Seeded rows keep **Company**; **Method** column header becomes **Scan method** on this sheet only.
- Network row status values: `live` | `disconnected`.
- nmap: `npm run discovery:install-nmap`; Tauri auto `brew install nmap` on macOS when probe runs.

## Non-Goals (P0)

- AWS / GCP / Azure API probes (P2)
- User-defined shell probes (P1)
- Remote Docker over SSH/TCP
- Auto-promote discovered rows to trusted instances

## Acceptance Criteria

1. Dialog runs passive LAN without nmap; active LAN + CIDR + nmap in Tauri.
2. US-05: No dead-end when user checks nmap on Passive LAN preset.
3. Browser dev mode surfaces Tauri warning.
4. `npm run typecheck`, `cargo check`, vitest discovery suites pass.
5. F33 dashboard artifacts and dev-log updated.
