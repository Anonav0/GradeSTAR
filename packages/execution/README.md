# @gradestar/execution

This package provides the Docker-based sandbox execution adapter for GradeSTAR.

## Planned Scope (Phase 5)

- Docker execution adapter with pluggable container driver
- Enforcing resource limits (CPU quota, memory, swap, pids-limit, disk)
- Network isolation (`--network none`)
- Read-only rootfs and safe tmpfs mounts
- Non-root execution with dropped Linux capabilities and `no-new-privileges`
- Forced cleanup and parent wall-clock timeout killing
