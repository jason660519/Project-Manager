# F61 Test Scenarios

## Scenario 1: Normal

**Given** native snapshot returns `homeDir` and Codex path evidence.  
**When** the service caller omits `homeDir`.  
**Then** Codex is detected using snapshot root metadata.

## Scenario 2: Boundary

**Given** browser fallback returns no roots and no path evidence.  
**When** service scans.  
**Then** deterministic missing rows are returned without throwing.

## Scenario 3: Abnormal

**Given** snapshot loader rejects before returning roots.  
**When** service scans.  
**Then** empty fallback rows and `snapshot_load_failed` diagnostic are returned.

## Scenario 4: Permission / Security

**Given** snapshot includes root metadata, secret-bearing paths, and fixture fake secret contents.  
**When** service/Rust snapshot output is serialized.  
**Then** roots and paths may appear, but fake secret values and `fileContents` must not.
