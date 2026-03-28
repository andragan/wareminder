## Why

The project has two competing planning workflows side by side: the old `speckit` system (`.specify/` folder, `/speckit.*` prompt commands, and `speckit.*` agent files) and the new `openspec` CLI-based workflow (`openspec/` folder, `/opsx:*` prompt commands). The speckit artifacts are no longer used and create confusion about which system is authoritative. Removing speckit cleans up the workspace and establishes a single workflow.

## What Changes

- Remove all speckit prompt files (`.github/prompts/speckit.*.prompt.md` — 8 files)
- Remove all speckit agent files (`.github/agents/speckit.*.agent.md` — 9 files)
- Remove the `.specify/` directory tree (templates, memory, scripts)
- Remove speckit agent entries from `.github/copilot-instructions.md`
- Preserve in-progress feature data (`specs/002-premium-upgrade/.specify/analysis-report.md`) by migrating it into the `openspec/` structure

## Capabilities

### New Capabilities

- `speckit-removal`: Remove all speckit files, directories, and configuration references from the repository

### Modified Capabilities

<!-- No existing openspec specs exist — this is a housekeeping change only -->

## Impact

- `.github/prompts/` — 8 files deleted
- `.github/agents/` — 9 files deleted
- `.specify/` — entire directory removed (~15 files)
- `.github/copilot-instructions.md` — speckit agent entries removed from `<agents>` section
- `specs/002-premium-upgrade/.specify/analysis-report.md` — reviewed to determine if content needs to be migrated before deletion
- No runtime code (src/) is affected
