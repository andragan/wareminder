## ADDED Requirements

### Requirement: Speckit prompt files are removed
The repository SHALL contain no speckit prompt files under `.github/prompts/`. All files matching `speckit.*.prompt.md` MUST be deleted.

#### Scenario: No speckit prompts remain
- **WHEN** the repository is inspected after the change
- **THEN** no files matching `.github/prompts/speckit.*.prompt.md` exist

### Requirement: Speckit agent files are removed
The repository SHALL contain no speckit agent definition files under `.github/agents/`. All files matching `speckit.*.agent.md` MUST be deleted.

#### Scenario: No speckit agents remain
- **WHEN** the repository is inspected after the change
- **THEN** no files matching `.github/agents/speckit.*.agent.md` exist

### Requirement: The `.specify/` directory is removed
The repository SHALL contain no `.specify/` root directory. The entire tree (templates, memory, scripts) MUST be deleted.

#### Scenario: Root `.specify/` directory is gone
- **WHEN** the repository is inspected after the change
- **THEN** no directory at `.specify/` exists at the project root

### Requirement: Speckit agents are removed from copilot-instructions.md
The `.github/copilot-instructions.md` `<agents>` section SHALL contain no entries for speckit agents.

#### Scenario: No speckit agent entries in instructions
- **WHEN** copilot-instructions.md is read
- **THEN** no `<agent>` entry with a name starting with `speckit.` appears in the `<agents>` section

### Requirement: Feature-level `.specify/` subdirectories are removed
Any `.specify/` subdirectory inside individual feature directories (e.g., `specs/002-premium-upgrade/.specify/`) SHALL be deleted after reviewing its content for any information worth preserving.

#### Scenario: Feature `.specify/` directories are gone
- **WHEN** the repository is inspected after the change
- **THEN** no `.specify/` directory exists anywhere in the `specs/` tree
