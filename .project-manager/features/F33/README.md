# F33: Network Discovery Plan

**Status:** In Progress  
**Category:** Core/Integration  
**Points:** 8  
**Phase:** development  
**Located:** `/integrations-hub/connected-instances`

## Quick Links

- [Feature Spec](./feature-spec.md)
- [TDD Spec](./tdd-spec.md)
- [Dev Log](./dev-log.md)
- [Test Scenarios](./test-scenarios.md)

## Summary

Replace the single **Discover** button with a **Discover ▾** flow: users compose a **Discovery Plan** (scope × probes), run it via Tauri, and merge results into the Connected Instances sheet. P0 ships LAN passive/active probes (ARP, Bonjour, Docker local, nmap), presets, and Network Instances column semantics (**Scan method**, **live / disconnected**).

## P0 Scope

- Discovery Plan types + probe registry (TS)
- `run_discovery_plan` Tauri command (Rust)
- Discover plan dialog + split button in Integrations Hub
- Mapper/status updates for scanned rows
- Unit tests for plan validation and row mapping

## Deferred (P1+)

- Cloud probes (AWS EC2, GCP CE, Azure VM)
- Config-file custom command probes
- Remote Docker over SSH/TCP
- Promote scanned row → trusted instance
