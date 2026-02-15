<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial creation)

  Added principles:
    - I. Code Quality First (NEW)
    - II. Testing Standards (NEW)
    - III. User Experience Consistency (NEW)
    - IV. Performance Requirements (NEW)

  Added sections:
    - Development Workflow
    - Quality Gates

  Removed sections: (none — initial creation)

  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ no update needed (generic reference)
    - .specify/templates/spec-template.md         ✅ no update needed (generic reference)
    - .specify/templates/tasks-template.md        ✅ no update needed (generic reference)
    - .specify/templates/commands/                ✅ directory does not exist

  Follow-up TODOs: none
-->

# WAReminder Constitution

## Core Principles

### I. Code Quality First

All production code MUST adhere to the following non-negotiable standards:

- Every file MUST have a single, clear responsibility. Content scripts,
  background service workers, popup UI, and storage logic MUST reside in
  separate modules.
- Functions MUST NOT exceed 40 lines. Extract helpers when approaching
  the limit.
- All public functions MUST include JSDoc comments documenting parameters,
  return values, and side effects.
- No `any`-typed variables if TypeScript is adopted; plain JavaScript
  projects MUST use `// @ts-check` or equivalent static analysis.
- ESLint MUST be configured and enforced with zero warnings in CI.
  The rule set MUST include `no-unused-vars`, `no-implicit-globals`,
  and `consistent-return`.
- Magic numbers and hard-coded strings MUST be extracted into named
  constants in a dedicated constants file.
- Chrome extension Manifest V3 best practices MUST be followed: no
  remote code execution, minimal permissions, clear permission
  justifications in the manifest.

**Rationale**: A Chrome extension injecting into WhatsApp Web operates
in a hostile DOM environment. Clean, modular code is essential for
maintainability when WhatsApp changes its interface.

### II. Testing Standards

All features MUST be validated through automated tests before merge:

- Unit tests MUST cover every service and utility module. Minimum
  statement coverage threshold: 80%.
- Integration tests MUST verify the interaction between content script
  DOM manipulation and the Chrome storage API (using mocks or
  `chrome-extension-test-utils`).
- Each user story MUST have at least one end-to-end acceptance test
  that exercises the full reminder lifecycle: create → notify → complete.
- Tests MUST be runnable via a single command (`npm test` or equivalent).
- Test files MUST mirror the source directory structure
  (e.g., `src/services/reminder.js` → `tests/services/reminder.test.js`).
- Flaky tests MUST be fixed or quarantined within 24 hours of detection.
  A quarantined test MUST have a tracking issue.

**Rationale**: The extension depends on DOM selectors in a third-party
app that can change without notice. Comprehensive tests ensure
regressions are caught before users are affected.

### III. User Experience Consistency

The extension MUST feel native to WhatsApp Web at all times:

- All injected UI elements MUST match WhatsApp Web's visual language:
  font family, font size, color palette, border radius, and spacing.
- Interactive elements MUST provide immediate visual feedback (hover
  states, loading spinners, disabled states) within 100ms of user
  interaction.
- The reminder creation flow MUST complete in 3 clicks or fewer from
  any chat view.
- Error messages MUST be human-readable, actionable, and displayed
  inline — never as raw `alert()` dialogs.
- The popup dashboard MUST be responsive and usable at the default
  Chrome extension popup width (400px).
- All user-facing text MUST be externalized into a locale/messages
  file to support future internationalization.
- Notifications MUST include the contact name, reminder context, and
  a direct action to open the relevant chat.

**Rationale**: Users will only adopt the extension if it feels like a
seamless part of WhatsApp Web rather than an intrusive add-on.

### IV. Performance Requirements

The extension MUST NOT degrade the WhatsApp Web experience:

- Content script injection MUST complete in under 50ms. DOM observers
  MUST use `MutationObserver` with targeted selectors — never observe
  the entire document body.
- Popup UI MUST render its initial view (reminder list) in under 100ms
  as measured by `performance.now()`.
- Chrome storage operations MUST be batched where possible. No more
  than one read and one write per user action.
- The extension MUST support at least 10,000 stored reminders without
  perceptible lag in the popup list (virtual scrolling or pagination
  MUST be implemented when count exceeds 100).
- Background alarm checks MUST use the `chrome.alarms` API with a
  minimum interval of 1 minute — never `setInterval`.
- Memory footprint of the content script MUST stay below 5 MB as
  measured in Chrome DevTools.
- Bundle size for all extension assets MUST NOT exceed 500 KB
  uncompressed.

**Rationale**: WhatsApp Web is already resource-intensive. The extension
must be invisible in terms of performance impact to avoid user
frustration and potential uninstalls.

## Development Workflow

All contributors MUST follow this workflow:

- Feature work MUST occur on a dedicated branch named
  `<issue-number>-<short-description>` (e.g., `12-reminder-creation`).
- Commits MUST follow Conventional Commits format:
  `type(scope): description` (e.g., `feat(popup): add reminder list`).
- Every pull request MUST pass linting, all tests, and a manual
  smoke test on WhatsApp Web before merge.
- Pull requests MUST include a description of what changed, why, and
  how to test it.
- Direct commits to `main` are prohibited. All changes MUST go through
  pull request review.

## Quality Gates

The following gates MUST pass before any release to the Chrome Web Store:

- **Lint gate**: Zero ESLint errors and warnings.
- **Test gate**: All unit and integration tests pass with ≥80% statement
  coverage.
- **Performance gate**: Popup renders in <100ms; content script injects
  in <50ms (measured in CI or manual benchmark).
- **Manifest gate**: `manifest.json` declares only required permissions;
  no `<all_urls>` host permission; `host_permissions` limited to
  `*://web.whatsapp.com/*`.
- **Size gate**: Total extension bundle ≤500 KB uncompressed.
- **UX gate**: Manual verification that injected UI matches WhatsApp
  Web's current visual style on latest Chrome stable.

## Governance

This constitution is the authoritative source of project standards.
All code reviews, pull requests, and architectural decisions MUST
verify compliance with the principles defined above.

Amendments to this constitution require:

1. A written proposal describing the change and its rationale.
2. Review and approval by at least one project maintainer.
3. A migration plan if the change affects existing code or workflows.
4. An updated version number following semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition.
   - MINOR: New principle or materially expanded guidance.
   - PATCH: Clarifications, wording, or non-semantic refinements.

Complexity MUST be justified. If a proposed change adds process
overhead, the proposal MUST explain why the simpler alternative is
insufficient.

**Version**: 1.0.0 | **Ratified**: 2026-02-15 | **Last Amended**: 2026-02-15
