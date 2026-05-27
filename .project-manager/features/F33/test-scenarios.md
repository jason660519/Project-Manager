# Test Scenarios — F33: Network Discovery Plan

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| F33-S01 | Passive LAN preset → Run | ARP + Bonjour + Docker; Run enabled | candidate |
| F33-S02 | Active LAN + CIDR + nmap → Run | Host discovery; nmap sources in table | candidate |
| F33-S03 | Browser dev (no Tauri) | Warning in snapshot | candidate |
| F33-S04 | Scanned row Scan method + Live status | Column semantics | covered |
| F33-S05 | Quick Discover uses last plan | localStorage plan executed | candidate |
| F33-S06 | Passive LAN + check nmap | Auto Active LAN; CIDR field; Run enabled after CIDR | covered → `discovery.plan-mutations.test.ts` |
| F33-S07 | Passive LAN + nmap without CIDR | Run disabled; message asks for CIDR (not scope error) | covered |
| F33-S08 | `npm run discovery:install-nmap` | nmap on PATH; doctor OK | manual verified |
