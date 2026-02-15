# Implementation Plan: WhatsApp Follow-Up Reminder Extension (MVP)

**Branch**: `001-followup-reminders` | **Date**: 2026-02-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-followup-reminders/spec.md`

## Summary

Chrome extension (Manifest V3) that enables WhatsApp Web users to set per-chat follow-up reminders via an injected UI button, receive desktop notifications at the scheduled time, and manage all reminders through a popup dashboard. Uses Chrome local storage for persistence, Chrome Alarms API for scheduling, and content script injection with MutationObserver for WhatsApp Web DOM integration.

## Technical Context

**Language/Version**: JavaScript (ES2022+) with `// @ts-check` annotations per constitution  
**Primary Dependencies**: Chrome Extensions API (Manifest V3), no external frameworks for MVP (vanilla JS/HTML/CSS)  
**Storage**: Chrome `chrome.storage.local` (MVP); future migration to Supabase  
**Testing**: Jest with `jest-chrome` mock library for Chrome APIs; manual smoke tests on WhatsApp Web  
**Target Platform**: Chrome browser (desktop: Windows, macOS, Linux); Chromium-based browsers secondary  
**Project Type**: Single (Chrome extension with content script, service worker, popup)  
**Performance Goals**: Content script injection <50ms; popup render <100ms; notification delivery within 60s of scheduled time; support 10,000 stored reminders  
**Constraints**: Bundle size ≤500KB uncompressed; content script memory <5MB; max 1 storage read + 1 write per user action; minimum alarm interval 1 minute (Chrome Alarms API)  
**Scale/Scope**: Single-user local extension; 500 DAU target within 3 months; 5 active reminders (free plan) / unlimited (paid)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate (Phase 0 Entry)

| # | Constitution Principle | Requirement | Status | Notes |
|---|----------------------|-------------|--------|-------|
| 1 | I. Code Quality First | Single responsibility per file; content script, service worker, popup, storage in separate modules | ✅ PASS | Project structure separates these concerns |
| 2 | I. Code Quality First | Functions ≤40 lines; JSDoc on all public functions | ✅ PASS | Will enforce during implementation |
| 3 | I. Code Quality First | `// @ts-check` or TypeScript; ESLint with zero warnings | ✅ PASS | Technical Context specifies `// @ts-check` + ESLint |
| 4 | I. Code Quality First | No magic numbers; constants in dedicated file | ✅ PASS | Plan includes `src/lib/constants.js` |
| 5 | I. Code Quality First | MV3 best practices; minimal permissions; no remote code | ✅ PASS | Spec declares only `alarms`, `storage`, `notifications`, host `*://web.whatsapp.com/*` |
| 6 | II. Testing Standards | Unit tests ≥80% coverage; integration tests for content script + storage | ✅ PASS | Jest + jest-chrome planned |
| 7 | II. Testing Standards | E2E acceptance test per user story; `npm test` single command | ✅ PASS | Will be defined in tasks |
| 8 | II. Testing Standards | Test files mirror source structure | ✅ PASS | `tests/` mirrors `src/` |
| 9 | III. UX Consistency | Injected UI matches WhatsApp Web visual language | ✅ PASS | FR-001 requires visual consistency |
| 10 | III. UX Consistency | 3 clicks or fewer for reminder creation | ✅ PASS | SC-001 explicitly requires this |
| 11 | III. UX Consistency | Inline errors, no `alert()` dialogs | ✅ PASS | Spec requires inline errors (FR-003) |
| 12 | III. UX Consistency | User-facing text externalized for i18n | ✅ PASS | Will use `_locales/` Chrome i18n structure |
| 13 | IV. Performance | Content script injection <50ms; popup render <100ms | ✅ PASS | Matches Technical Context constraints |
| 14 | IV. Performance | Max 1 read + 1 write per user action | ✅ PASS | Storage service will batch operations |
| 15 | IV. Performance | Virtual scrolling/pagination when >100 reminders | ✅ PASS | Will implement in popup dashboard |
| 16 | IV. Performance | Bundle ≤500KB; content script memory <5MB | ✅ PASS | Vanilla JS, no framework overhead |
| 17 | Dev Workflow | Feature branch naming; Conventional Commits | ✅ PASS | Branch `001-followup-reminders` follows convention |
| 18 | Quality Gates | Lint, test, perf, manifest, size, UX gates before release | ✅ PASS | All gates accounted for in plan |

**Gate Result**: ✅ ALL PASS — Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── content/
│   ├── injector.js          # DOM injection for "Set Reminder" button
│   ├── chat-observer.js     # MutationObserver for WhatsApp Web DOM changes
│   ├── reminder-prompt.js   # Time-selection UI overlay
│   └── styles.css           # Injected UI styles matching WhatsApp Web
├── background/
│   ├── service-worker.js    # MV3 service worker entry point
│   ├── alarm-handler.js     # Chrome Alarms API scheduling & firing
│   └── notification-handler.js # Desktop notification creation & click handling
├── popup/
│   ├── popup.html           # Dashboard HTML
│   ├── popup.js             # Dashboard logic (list, complete, delete)
│   └── popup.css            # Dashboard styles
├── services/
│   ├── reminder-service.js  # CRUD operations for reminders
│   ├── storage-service.js   # Chrome storage abstraction (read/write batching)
│   ├── plan-service.js      # Free/paid plan limit enforcement
│   └── chat-service.js      # Chat reference extraction & navigation
├── lib/
│   ├── constants.js         # Named constants (limits, defaults, selectors)
│   ├── validators.js        # Input validation (future time, required fields)
│   └── utils.js             # Shared helpers (date formatting, ID generation)
├── _locales/
│   └── en/
│       └── messages.json    # Externalized user-facing strings
├── manifest.json            # MV3 manifest
└── icons/                   # Extension icons (16, 48, 128px)

tests/
├── unit/
│   ├── services/
│   │   ├── reminder-service.test.js
│   │   ├── storage-service.test.js
│   │   ├── plan-service.test.js
│   │   └── chat-service.test.js
│   └── lib/
│       ├── validators.test.js
│       └── utils.test.js
├── integration/
│   ├── content-storage.test.js    # Content script ↔ storage interaction
│   ├── alarm-notification.test.js # Alarm firing ↔ notification creation
│   └── popup-storage.test.js      # Popup ↔ storage interaction
└── e2e/
    ├── create-reminder.test.js
    ├── receive-notification.test.js
    ├── manage-reminders.test.js
    └── badge-count.test.js
```

**Structure Decision**: Single Chrome extension project. Content script, service worker, and popup are separate entry points per MV3 architecture. Shared logic lives in `services/` and `lib/`. No frontend framework — vanilla JS keeps bundle size well under the 500KB constitution limit.

## Complexity Tracking

> No constitution violations detected. All design decisions align with existing principles.
