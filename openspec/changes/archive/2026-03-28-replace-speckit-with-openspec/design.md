## Context

The project accumulated two planning workflows during a tooling transition. The older `speckit` system used:
- `.specify/` directory: templates, memory files, and bash scripts
- `.github/prompts/speckit.*.prompt.md`: 8 prompt files invoking speckit agents
- `.github/agents/speckit.*.agent.md`: 9 agent definition files

The new `openspec` CLI-based system is now fully in place with its own prompts (`/opsx:propose`, `/opsx:apply`, `/opsx:explore`, `/opsx:archive`) and stores changes in `openspec/changes/`. Speckit is no longer invoked in any active workflow.

## Goals / Non-Goals

**Goals:**
- Delete all speckit prompt files, agent files, and the `.specify/` directory
- Remove speckit agent entries from `.github/copilot-instructions.md`
- Confirm whether `specs/002-premium-upgrade/.specify/analysis-report.md` contains content worth preserving before deletion

**Non-Goals:**
- Modifying any openspec files or the `openspec/` directory structure
- Changing source code in `src/`
- Migrating speckit template content into openspec (openspec uses its own schema-driven templates)
- Deleting `specs/` feature directories (only the `.specify` subdirectory inside them)

## Decisions

**Delete `.specify/` entirely**
The templates are only used by speckit agents. Memory files (`002-decisions.md`, `002-implementation-progress.md`) record completed implementation notes for the 002-premium-upgrade feature that has already shipped; they can be deleted without impact. The constitution (`constitution.md`) codifies principles that are now implicit in the active codebase conventions — no migration needed.

Alternatives considered: migrating constitution into `openspec/config.yaml` context — rejected, adds complexity for a cleanup task.

**Delete all speckit prompts and agents**
They reference each other (e.g., speckit.plan invokes speckit.tasks) and would not function without the `.specify/` scripts they depend on. Dead code removal.

**Remove speckit from `copilot-instructions.md` `<agents>` section**
Listed agents must correspond to files that exist; stale entries cause confusion about available commands.

**Review `specs/002-premium-upgrade/.specify/analysis-report.md` before deletion**
This is inside a feature directory, not `.specify/` root. Read it, determine if any content is needed, then delete.

## Risks / Trade-offs

- **Risk: Losing decision history in `.specify/memory/`** → Mitigation: The decisions recorded there apply to already-shipped features; no active development depends on them.
- **Risk: Removing constitution.md causes lost principles** → Mitigation: Principles are now embedded in copilot-instructions.md and skills; the constitution file is redundant.
- **Risk: Breaking cross-referencing prompts** → Mitigation: All speckit prompts are being removed together; no partial state.
