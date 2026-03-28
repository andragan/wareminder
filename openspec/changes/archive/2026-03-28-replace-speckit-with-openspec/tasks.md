## 1. Review content before deletion

- [x] 1.1 Read `specs/002-premium-upgrade/.specify/analysis-report.md` and confirm no content needs to be preserved
- [x] 1.2 Read `.specify/memory/002-decisions.md` and confirm decisions are captured elsewhere
- [x] 1.3 Read `.specify/memory/002-implementation-progress.md` and confirm no active tracking info is needed

## 2. Remove speckit prompt files

- [x] 2.1 Delete `.github/prompts/speckit.analyze.prompt.md`
- [x] 2.2 Delete `.github/prompts/speckit.clarify.prompt.md`
- [x] 2.3 Delete `.github/prompts/speckit.checklist.prompt.md`
- [x] 2.4 Delete `.github/prompts/speckit.constitute.prompt.md` (if exists) and `.github/prompts/speckit.constitution.prompt.md`
- [x] 2.5 Delete `.github/prompts/speckit.implement.prompt.md`
- [x] 2.6 Delete `.github/prompts/speckit.plan.prompt.md`
- [x] 2.7 Delete `.github/prompts/speckit.specify.prompt.md`
- [x] 2.8 Delete `.github/prompts/speckit.tasks.prompt.md`
- [x] 2.9 Delete `.github/prompts/speckit.taskstoissues.prompt.md`

## 3. Remove speckit agent files

- [x] 3.1 Delete `.github/agents/speckit.analyze.agent.md`
- [x] 3.2 Delete `.github/agents/speckit.checklist.agent.md`
- [x] 3.3 Delete `.github/agents/speckit.clarify.agent.md`
- [x] 3.4 Delete `.github/agents/speckit.constitution.agent.md`
- [x] 3.5 Delete `.github/agents/speckit.implement.agent.md`
- [x] 3.6 Delete `.github/agents/speckit.plan.agent.md`
- [x] 3.7 Delete `.github/agents/speckit.specify.agent.md`
- [x] 3.8 Delete `.github/agents/speckit.tasks.agent.md`
- [x] 3.9 Delete `.github/agents/speckit.taskstoissues.agent.md`

## 4. Remove the `.specify/` directory

- [x] 4.1 Delete `.specify/templates/` directory and all contents
- [x] 4.2 Delete `.specify/memory/` directory and all contents
- [x] 4.3 Delete `.specify/scripts/` directory and all contents
- [x] 4.4 Delete `specs/002-premium-upgrade/.specify/` directory and all contents
- [x] 4.5 Verify no `.specify/` directories remain anywhere in the repository

## 5. Clean up speckit references in configuration files

- [x] 5.1 Remove `chat.promptFilesRecommendations` entries for all speckit.* prompts from `.vscode/settings.json`
- [x] 5.2 Remove `.specify/scripts/bash/` auto-approve entries from `chat.tools.terminal.autoApprove` in `.vscode/settings.json`
- [x] 5.3 Remove speckit agent entries from the `<agents>` section of `.github/copilot-instructions.md` (if present)

## 6. Verify

- [x] 6.1 Search repository for remaining `speckit` references and confirm all are gone
- [x] 6.2 Confirm `openspec/` directory and all opsx prompts remain intact and unmodified
